'use strict';

const { Service, Professional } = require('../models');
const clientService             = require('../services/client.service');
const { getArgentinaDateInfo }  = require('./dateUtils');

const DEFAULT_RULES = 'Help the client book and cancel appointments in a friendly way.';

function resolvePlaceholders(template, vars) {
  return template.replace(/\{[^}]+\}/g, match => vars[match] ?? match);
}

async function buildSystemPrompt(business, senderName, fromPhone) {
  const client = await clientService.findOrCreate(business.id, {
    phone: fromPhone,
    name:  senderName,
  });

  const [services, professionals] = await Promise.all([
    Service.findAll({
      where:      { businessId: business.id },
      attributes: ['id', 'name', 'durationMinutes', 'price'],
      order:      [['durationMinutes', 'ASC']],
    }),
    Professional.findAll({
      where:      { businessId: business.id, active: true },
      attributes: ['id', 'name'],
      order:      [['name', 'ASC']],
    }),
  ]);

  const servicesList = services.length > 0
    ? services.map(s => {
        const price = s.price ? ` · $${s.price}` : '';
        return `  - ${s.name} · ${s.durationMinutes} min${price} · id: ${s.id}`;
      }).join('\n')
    : '  (no services loaded yet)';

  const professionalsList = professionals.length > 0
    ? professionals.map(p => `  - ${p.name} (id: ${p.id})`).join('\n')
    : '  (no active professionals)';

  const { readable: todayReadable, isoDate: todayISO } = getArgentinaDateInfo();

  const templateRaw  = business.systemPrompt?.trim() ?? DEFAULT_RULES;
  const agentName    = business.agentName ?? 'the assistant';

  const vars = {
    '{agente_nombre}':        agentName,
    '{negocio_nombre}':       business.name,
    '{negocio_rubro}':        business.sector,
    '{fecha_actual}':         `${todayReadable} (${todayISO})`,
    '{cliente_id}':           String(client.id),
    '{cliente_nombre}':       client.name ?? 'null',
    '{cliente_telefono}':     fromPhone,
    '{servicios_lista}':      servicesList,
    '{profesionales_lista}':  professionalsList,
  };

  const businessRules    = resolvePlaceholders(templateRaw, vars);
  const usesPlaceholders = Object.keys(vars).some(p => templateRaw.includes(p));

  // Modern prompts (with placeholders): the business template is the single source of truth.
  if (usesPlaceholders) return businessRules;

  // Legacy prompts (without placeholders): inject dynamic data + base instructions.
  const dataSection = `

DYNAMIC DATA:
- Business: ${business.name} (${business.sector})
- Current date (Argentina, UTC-3): ${todayReadable} (${todayISO})
- Client: ${senderName} / ${fromPhone}
- Available services:
${servicesList}`;

  return `
${businessRules}${dataSection}

APPOINTMENT BOOKING FLOW:
1. If the client has not provided their name, ask ONCE. When they do, call update_client.
2. Check availability with get_availability using the appropriate serviceId.
3. Present options and wait for the client to confirm date, time and (if applicable) professional.
4. Summarize the appointment and ask "Do you confirm?" explicitly. Wait for the response.
5. Only if the client confirms: FIRST call create_appointment and wait for the result. NEVER confirm verbally without receiving a valid appointment ID.
6. If create_appointment returns a conflict, apologize and offer alternatives with get_availability.
7. After a successful create_appointment, confirm to the client according to the business rules.

APPOINTMENT CANCELLATION FLOW:
1. Call get_client_appointments to retrieve active appointments.
2. Show the appointments in plain language (no IDs).
3. Wait for the client to indicate which one to cancel.
4. Call cancel_appointment with the corresponding ID.
5. Confirm the cancellation.

DATE FORMAT RULES:
- With the client: natural language ("Monday May 25 at 10:00 am").
- With the APIs: ISO format without timezone ("2026-05-25T10:00:00").
- Never schedule past dates.

GENERAL RULES:
- Greet the client by name only in the first message.
- Reply in a friendly and concise manner. Keep messages short.
- Never invent availability — always query the tools.
- Do not mention IDs, function names, or technical terms to the client.
- NEVER ask the client for their phone number — you already have it.
`.trim();
}

module.exports = { buildSystemPrompt };
