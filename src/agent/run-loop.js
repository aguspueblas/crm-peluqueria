'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_MODEL         = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS    = 512;
const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_MAX_INPUT_LEN  = 1000;

/**
 * Generic Tool Use loop.
 *
 * @param {object} opts
 * @param {object}   opts.business        - Negocio resuelto por el webhook
 * @param {string}   opts.from            - Número de teléfono del remitente
 * @param {string}   opts.message         - Mensaje entrante
 * @param {Array}    opts.tools           - Definición de tools para la API de Anthropic
 * @param {Function} opts.execute         - async (toolName, input, businessId) => result
 * @param {Function} opts.buildPrompt     - async (business, from) => systemPrompt string
 * @param {object}   opts.store           - { load, save, prune, markDelegated? }
 * @param {Function} [opts.onSpecialTool]        - async ({ toolName, input, result, business, from }) => { delegated: bool }
 * @param {boolean}  [opts.finalTurnOnDelegate]  - if true, make one extra Anthropic call after delegation so the bot can say goodbye; default false (silent)
 * @param {string}   [opts.model]
 * @param {number}   [opts.maxTokens]
 * @param {number}   [opts.maxIterations]
 * @param {number}   [opts.maxInputLen]
 */
async function runLoop({
  business,
  from,
  message,
  tools,
  execute,
  buildPrompt,
  store,
  onSpecialTool,
  finalTurnOnDelegate = false,
  model         = DEFAULT_MODEL,
  maxTokens     = DEFAULT_MAX_TOKENS,
  maxIterations = DEFAULT_MAX_ITERATIONS,
  maxInputLen   = DEFAULT_MAX_INPUT_LEN,
}) {
  const safeMessage  = message.slice(0, maxInputLen);
  const history      = await store.load(business.id, from);
  history.push({ role: 'user', content: safeMessage });

  const systemPrompt = await buildPrompt(business, from);
  let   messages     = store.prune(history);

  let iterations = 0;

  try {
  while (iterations < maxIterations) {
    iterations++;

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system:     systemPrompt,
      tools,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find(b => b.type === 'text')?.text ?? '';
      history.push({ role: 'assistant', content: text });
      await store.save(business.id, from, history);
      return text;
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const toolResults = [];
      let delegated     = false;

      for (const block of response.content.filter(b => b.type === 'tool_use')) {
        console.log(`[run-loop] tool_call business=${business.id} tool=${block.name} input=${JSON.stringify(block.input)}`);
        const result = await execute(block.name, block.input, business.id);
        console.log(`[run-loop] tool_result business=${business.id} tool=${block.name} result=${JSON.stringify(result)}`);

        if (onSpecialTool) {
          const { delegated: d } = await onSpecialTool({
            toolName: block.name,
            input:    block.input,
            result,
            business,
            from,
            store,
          });
          if (d) delegated = true;
        }

        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: toolResults });

      if (delegated) {
        if (finalTurnOnDelegate) {
          const finalResponse = await anthropic.messages.create({
            model,
            max_tokens: maxTokens,
            system:     systemPrompt,
            tools,
            messages,
          });
          const text = finalResponse.content.find(b => b.type === 'text')?.text ?? '';
          history.push({ role: 'assistant', content: text });
          await store.save(business.id, from, history);
          return text;
        }
        await store.save(business.id, from, history);
        return null;
      }
    }
  }

  } catch (err) {
    console.error(`[run-loop] unhandled error business=${business.id}: ${err.message}`, err.stack);
  }

  return null;
}

module.exports = { runLoop };
