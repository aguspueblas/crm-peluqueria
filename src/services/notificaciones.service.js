'use strict';

const twilio = require('twilio');

let _client = null;
function getClient() {
  if (!_client) _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return _client;
}

async function notificarDerivacion(negocio, clientePhone, motivo) {
  if (!negocio.admin_phone) return;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return;

  const from = process.env.TWILIO_WHATSAPP_FROM ?? `whatsapp:${negocio.whatsapp_number}`;
  const to   = `whatsapp:${negocio.admin_phone}`;
  const body = `[${negocio.nombre}] Derivación pendiente\nCliente: ${clientePhone}\nMotivo: ${motivo}`;

  try {
    await getClient().messages.create({ from, to, body });
    console.log(`[notif] derivacion enviada negocio=${negocio.id} admin=${negocio.admin_phone}`);
  } catch (err) {
    console.error(`[notif] error enviando derivacion negocio=${negocio.id}: ${err.message}`);
  }
}

module.exports = { notificarDerivacion };
