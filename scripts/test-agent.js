/**
 * Script de prueba del agente — solo para desarrollo.
 * Mockea la API de Anthropic para validar el flujo completo sin costos.
 *
 * Uso:
 *   node scripts/test-agent.js
 *   node scripts/test-agent.js "quiero cancelar mi turno"
 */
'use strict';

require('dotenv').config();

// ─── Mock de Anthropic SDK ────────────────────────────────────────────────────
// Intercepta el require ANTES de que runner.js lo cargue.
// El código de producción no se toca en absoluto.
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

            console.log('\n[MOCK] Claude recibió:', text);
            console.log('[MOCK] Tools disponibles:', tools.map(t => t.name).join(', '));

            return {
              stop_reason: 'end_turn',
              content: [{
                type: 'text',
                text: `[RESPUESTA MOCK] Entendí tu mensaje: "${text}". En producción Claude respondería aquí.`,
              }],
            };
          },
        };
      }
    };
  }
  return _originalLoad.apply(this, arguments);
};
// ─────────────────────────────────────────────────────────────────────────────

const { Negocio } = require('../src/models');
const runner      = require('../src/agent/runner');

const message     = process.argv[2] ?? 'hola, quiero sacar un turno';
const fromPhone   = '5491199999999';
const senderName  = 'Usuario Test';

async function main() {
  const negocio = await Negocio.findOne({ where: { activo: true } });

  if (!negocio) {
    console.error('❌ No hay negocios activos en la DB. Creá uno primero.');
    process.exit(1);
  }

  console.log(`\n🏪 Negocio: ${negocio.nombre} (id=${negocio.id})`);
  console.log(`📱 Cliente: ${senderName} (${fromPhone})`);
  console.log(`💬 Mensaje: "${message}"\n`);

  const reply = await runner.run({ negocio, from: fromPhone, senderName, message });

  console.log('\n🤖 Respuesta del agente:');
  console.log(reply);
  console.log('\n✅ Flujo completo OK (store, executor, prompt, runner)');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
