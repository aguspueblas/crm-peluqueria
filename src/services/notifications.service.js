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

async function notifyDelegation(business, clientPhone, reason, adminPhones = []) {
  const phones = adminPhones.length ? adminPhones : (business.adminPhone ? [business.adminPhone] : []);
  if (!phones.length) return;
  const from = (process.env.AGENDAI_WHATSAPP_FROM ?? process.env.TWILIO_WHATSAPP_FROM ?? `whatsapp:${business.whatsappNumber}`).replace('whatsapp:', '');
  const body = `[${business.name}] Handoff pending\nClient: ${clientPhone}\nReason: ${reason}`;
  await Promise.all(phones.map(phone => sendWhatsApp(phone, from, body)));
  console.log(`[notifications] delegation sent business=${business.id} admins=${phones.join(',')}`);
}

async function notifyNewAppointment(business, appointment, adminPhones = []) {
  const phones = adminPhones.length ? adminPhones : (business.adminPhone ? [business.adminPhone] : []);
  if (!phones.length) return;
  const from = (process.env.AGENDAI_WHATSAPP_FROM ?? process.env.TWILIO_WHATSAPP_FROM ?? `whatsapp:${business.whatsappNumber}`).replace('whatsapp:', '');
  const { Client: client, Professional: professional, Service: service } = appointment;
  const date = new Date(appointment.scheduledAt).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const body = [
    `[${business.name}] Nuevo turno agendado`,
    `Servicio: ${service?.name ?? '—'}`,
    `Horario: ${date}`,
    `Dirección: ${appointment.address ?? '—'}`,
    `Profesional: ${professional?.name ?? '—'}`,
    `Cliente: ${client?.name ?? '—'} (${client?.phone ?? '—'})`,
    ``,
    `Pendiente: chequear envío de seña.`,
  ].join('\n');
  await Promise.all(phones.map(phone => sendWhatsApp(phone, from, body)));
  console.log(`[notifications] new appointment sent business=${business.id} admins=${phones.join(',')}`);
}

module.exports = { sendWhatsApp, notifyDelegation, notifyNewAppointment };
