'use strict';

/**
 * Agent test script — development only.
 * Mocks the Anthropic SDK to validate the full flow without incurring costs.
 *
 * Usage:
 *   node scripts/test-agent.js
 *   node scripts/test-agent.js "I want to cancel my appointment"
 */

require('dotenv').config();

// Mock the Anthropic SDK before runner.js loads it.
// Production code is not touched at all.
const Module = require('module');
const _originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === '@anthropic-ai/sdk') {
    return class MockAnthropic {
      constructor() {}
      get messages() {
        return {
          create: async ({ messages, tools }) => {
            const lastUser = [...messages].reverse().find(m => m.role === 'user');
            const text = typeof lastUser?.content === 'string'
              ? lastUser.content
              : '[tool result]';

            console.log('\n[mock] Claude received:', text);
            console.log('[mock] Available tools:', tools.map(t => t.name).join(', '));

            return {
              stop_reason: 'end_turn',
              content: [{
                type: 'text',
                text: `[MOCK RESPONSE] Understood your message: "${text}". In production Claude would respond here.`,
              }],
            };
          },
        };
      }
    };
  }
  return _originalLoad.apply(this, arguments);
};

const { Business } = require('../src/models');
const runner       = require('../src/agent/runner');

const message    = process.argv[2] ?? 'hi, I want to book an appointment';
const fromPhone  = '5491199999999';
const senderName = 'Test User';

async function main() {
  const business = await Business.findOne({ where: { active: true } });

  if (!business) {
    console.error('[error] No active businesses found in DB. Create one first.');
    process.exit(1);
  }

  console.log(`\n[business] ${business.name} (id=${business.id})`);
  console.log(`[client]   ${senderName} (${fromPhone})`);
  console.log(`[message]  "${message}"\n`);

  const reply = await runner.run({ business, from: fromPhone, senderName, message });

  console.log('\n[agent reply]');
  console.log(reply);
  console.log('\n[ok] Full flow completed (store, executor, prompt, runner)');

  process.exit(0);
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
