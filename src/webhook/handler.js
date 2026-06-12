'use strict';

const { Business } = require('../models');
const runner        = require('../agent/runner');
const store         = require('../conversation/store');

// Rate limiting: max 5 messages per minute per phone number (in-memory, resets on restart)
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

setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > 60_000) rateLimitStore.delete(phone);
  }
}, 5 * 60 * 1000);

async function handleIncoming(normalizedMessage, provider) {
  const { from, to, body, senderName } = normalizedMessage;

  if (isRateLimited(from)) return;

  const business = await Business.findOne({ where: { whatsappNumber: to, active: true } });
  if (!business) return;

  const status = await store.getStatus(business.id, from);
  if (status === 'derivada') return;

  const reply = await runner.run({ business, from, senderName, message: body });
  await provider.send(from, to, reply);
}

module.exports = { handleIncoming };
