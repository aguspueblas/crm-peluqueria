'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { TOOLS }            = require('./tools');
const { execute }          = require('./executor');
const { buildSystemPrompt } = require('./prompt');
const store                = require('../conversation/store');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_ITERATIONS = 8;
const MAX_INPUT_LEN  = 1000;

async function run({ negocio, from, senderName, message }) {
  const safeMessage = message.slice(0, MAX_INPUT_LEN);

  const history = await store.load(negocio.id, from);
  history.push({ role: 'user', content: safeMessage });

  const systemPrompt = await buildSystemPrompt(negocio, senderName, from);
  let messages = store.prune(history);

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,
      system:     systemPrompt,
      tools:      TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find(b => b.type === 'text')?.text ?? '';
      history.push({ role: 'assistant', content: text });
      await store.save(negocio.id, from, history);
      return text;
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const toolResults = [];

      for (const block of response.content.filter(b => b.type === 'tool_use')) {
        console.log(`[agent] tool_call negocio=${negocio.id} tool=${block.name} input=${JSON.stringify(block.input)}`);
        const result = await execute(block.name, block.input, negocio.id);
        console.log(`[agent] tool_result negocio=${negocio.id} tool=${block.name} result=${JSON.stringify(result)}`);
        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  return 'Ocurrió un error procesando tu mensaje. Por favor intentá de nuevo.';
}

module.exports = { run };
