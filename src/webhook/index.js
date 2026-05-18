'use strict';

const express  = require('express');
const router   = express.Router();
const handler  = require('./handler');
const twilio   = require('./providers/twilio');

const PROVIDERS = { twilio };
const provider  = PROVIDERS[process.env.WHATSAPP_PROVIDER ?? 'twilio'];

if (!provider) {
  throw new Error(`Unknown WHATSAPP_PROVIDER: ${process.env.WHATSAPP_PROVIDER}`);
}

router.post('/', express.urlencoded({ extended: false }), async (req, res) => {
  if (!provider.validateSignature(req)) {
    return res.status(403).end();
  }

  const message = provider.parseIncoming(req);
  if (!message) return res.status(200).end();

  // Responder 200 a Twilio inmediatamente para evitar reintentos
  res.status(200).end();

  // Procesar en background
  handler.handleIncoming(message, provider).catch(err => {
    console.error('[webhook] error procesando mensaje:', err.message);
  });
});

module.exports = router;
