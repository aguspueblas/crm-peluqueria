'use strict';

const { Negocio } = require('../models');
const runner      = require('../agent/runner');

// Rate limiting: máx 5 mensajes por minuto por número de teléfono
const rateLimitStore = new Map();

function isRateLimited(phone) {
  const now   = Date.now();
  const entry = rateLimitStore.get(phone) ?? { count: 0, windowStart: now };

  if (now - entry.windowStart > 60_000) {
    rateLimitStore.set(phone, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  rateLimitStore.set(phone, entry);
  return false;
}

// Limpia entradas viejas del rate limit store cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > 60_000) rateLimitStore.delete(phone);
  }
}, 5 * 60 * 1000);

async function handleIncoming(normalizedMessage, provider) {
  const { from, to, body, senderName } = normalizedMessage;

  if (isRateLimited(from)) return;

  const negocio = await Negocio.findOne({ where: { whatsapp_number: to, activo: true } });
  if (!negocio) return;

  const reply = await runner.run({ negocio, from, senderName, message: body });

  await provider.send(from, to, reply);
}

module.exports = { handleIncoming };
