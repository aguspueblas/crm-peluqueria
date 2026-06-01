'use strict';

const twilio = require('twilio');

let _client = null;

function getClient() {
  if (!_client) _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return _client;
}

async function sendWhatsApp(to, from, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return;
  try {
    await getClient().messages.create({
      from: `whatsapp:${from}`,
      to:   `whatsapp:${to}`,
      body,
    });
  } catch (err) {
    console.error(`[notifications] failed to send WhatsApp to=${to}: ${err.message}`);
  }
}

async function notifyDelegation(business, clientPhone, reason) {
  if (!business.adminPhone) return;
  const from = process.env.TWILIO_WHATSAPP_FROM ?? `whatsapp:${business.whatsappNumber}`;
  const body = `[${business.name}] Handoff pending\nClient: ${clientPhone}\nReason: ${reason}`;
  await sendWhatsApp(business.adminPhone, from.replace('whatsapp:', ''), body);
  console.log(`[notifications] delegation sent business=${business.id} admin=${business.adminPhone}`);
}

async function notifyNewAppointment(business, appointment) {
  if (!business.adminPhone) return;
  const from = process.env.TWILIO_WHATSAPP_FROM ?? `whatsapp:${business.whatsappNumber}`;
  const { Client: client, Professional: professional, Service: service } = appointment;
  const date = new Date(appointment.scheduledAt).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const body = `[${business.name}] New appointment\nClient: ${client?.name ?? 'unknown'} (${client?.phone ?? ''})\nDate: ${date}\nService: ${service?.name ?? ''}\nProfessional: ${professional?.name ?? ''}`;
  await sendWhatsApp(business.adminPhone, from.replace('whatsapp:', ''), body);
  console.log(`[notifications] new appointment sent business=${business.id} admin=${business.adminPhone}`);
}

module.exports = { sendWhatsApp, notifyDelegation, notifyNewAppointment };
