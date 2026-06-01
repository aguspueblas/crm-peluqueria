'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { TOOLS }                             = require('./tools');
const { execute }                           = require('./executor');
const { buildSystemPrompt }                 = require('./prompt');
const store                                 = require('../conversation/store');
const { notifyDelegation, notifyNewAppointment } = require('../services/notifications.service');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_ITERATIONS = 8;
const MAX_INPUT_LEN  = 1000;

async function run({ business, from, senderName, message }) {
  const safeMessage = message.slice(0, MAX_INPUT_LEN);

  const history     = await store.load(business.id, from);
  history.push({ role: 'user', content: safeMessage });

  const systemPrompt = await buildSystemPrompt(business, senderName, from);
  let messages = store.prune(history);

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     systemPrompt,
      tools:      TOOLS,
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
      let delegated    = false;

      for (const block of response.content.filter(b => b.type === 'tool_use')) {
        console.log(`[agent] tool_call business=${business.id} tool=${block.name} input=${JSON.stringify(block.input)}`);
        const result = await execute(block.name, block.input, business.id);
        console.log(`[agent] tool_result business=${business.id} tool=${block.name} result=${JSON.stringify(result)}`);

        if (block.name === 'notify_admin') {
          notifyDelegation(business, from, block.input.reason ?? '').catch(err =>
            console.error(`[agent] notify_admin failed: ${err.message}`)
          );
        }

        if (block.name === 'create_appointment' && !result.error) {
          notifyNewAppointment(business, result).catch(err =>
            console.error(`[agent] notify_new_appointment failed: ${err.message}`)
          );
        }

        if (block.name === 'delegate_to_admin') {
          await store.markDelegated(business.id, from);
          notifyDelegation(business, from, block.input.reason ?? '').catch(err =>
            console.error(`[agent] delegate notification failed: ${err.message}`)
          );
          delegated = true;
        }

        toolResults.push({
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        });
      }

      messages.push({ role: 'user', content: toolResults });

      if (delegated) {
        // One final turn so the agent can say goodbye to the client
        const finalResponse = await anthropic.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system:     systemPrompt,
          tools:      TOOLS,
          messages,
        });
        const text = finalResponse.content.find(b => b.type === 'text')?.text ?? '';
        history.push({ role: 'assistant', content: text });
        await store.save(business.id, from, history);
        return text;
      }
    }
  }

  return 'An error occurred while processing your message. Please try again.';
}

module.exports = { run };
