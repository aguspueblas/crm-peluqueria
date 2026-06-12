'use strict';

const twilio = require('twilio');

let _client = null;

function getClient() {
  if (!_client) _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return _client;
}

function parseIncoming(req) {
  const { From, To, Body, ProfileName } = req.body;
  if (!From || !To || !Body) return null;
  return {
    from:       From.replace('whatsapp:', ''),
    to:         To.replace('whatsapp:', ''),
    body:       Body,
    senderName: ProfileName ?? 'Customer',
  };
}

async function send(to, from, text) {
  await getClient().messages.create({
    from: `whatsapp:${from}`,
    to:   `whatsapp:${to}`,
    body: text,
  });
}

function validateSignature(req, webhookUrl) {
  if (process.env.NODE_ENV === 'development') return true;
  const url = webhookUrl ?? process.env.TWILIO_WEBHOOK_URL;
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    req.headers['x-twilio-signature'] ?? '',
    url,
    req.body
  );
}

module.exports = { parseIncoming, send, validateSignature };
