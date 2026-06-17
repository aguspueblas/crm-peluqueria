'use strict';

const express       = require('express');
const router        = express.Router();
const adminRunner   = require('../agent/admin-runner');
const adminService  = require('../services/admin.service');
const twilio        = require('./providers/twilio');

// Separate rate-limit store for AgendAI (TODO-1: persist across restarts)
const rateLimitStore = new Map();

function isRateLimited(phone) {
  const now   = Date.now();
  const entry = rateLimitStore.get(phone) ?? { count: 0, windowStart: now };
  if (now - entry.windowStart > 60_000) {
    rateLimitStore.set(phone, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= 10) return true;
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

async function handleAdminMessage(normalizedMessage, provider) {
  const { from, to, body } = normalizedMessage;

  if (isRateLimited(from)) return;

  const adminUser = await adminService.findByPhone(from);
  if (!adminUser) {
    console.log(`[agendai] unknown admin phone=${from} — ignoring`);
    return;
  }

  const businesses = adminUser.Businesses ?? [];
  if (!businesses.length) {
    console.log(`[agendai] admin id=${adminUser.id} has no businesses — ignoring`);
    return;
  }

  const business = businesses[0];
  const reply    = await adminRunner.run({ business, adminUser, message: body });
  await provider.send(from, to, reply);
}

router.post('/', express.urlencoded({ extended: false }), async (req, res) => {
  if (!twilio.validateSignature(req)) {
    return res.status(403).end();
  }

  const message = twilio.parseIncoming(req);
  if (!message) return res.status(200).end();

  res.status(200).end();

  handleAdminMessage(message, twilio).catch(err => {
    console.error('[agendai] error procesando mensaje:', err.message, err.stack);
  });
});

module.exports = router;
