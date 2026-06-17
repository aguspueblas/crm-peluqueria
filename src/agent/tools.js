'use strict';

const TOOLS = [
  {
    name: 'get_services',
    description: 'List available services for the business (name, duration, price). Call at the start if the client has not specified a service.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_next_slots',
    description: 'DEFAULT tool to find availability. Returns the next N available time slots without needing a specific date. ALWAYS call this first when the client wants to book and has not named a specific date. Use get_availability ONLY if the client explicitly said a specific date (e.g. "I want Thursday").',
    input_schema: {
      type: 'object',
      properties: {
        serviceId:      { type: 'integer', description: 'Service ID' },
        count:          { type: 'integer', description: 'Number of slots to return (default: 3, max: 10)' },
        professionalId: { type: 'integer', description: 'Professional ID (optional)' },
      },
      required: ['serviceId'],
    },
  },
  {
    name: 'get_availability',
    description: 'Return available time slots for a service on a SPECIFIC date named by the client. Use ONLY when the client explicitly said a date (e.g. "I want Thursday", "next Monday"). For open-ended availability, use get_next_slots instead.',
    input_schema: {
      type: 'object',
      properties: {
        date:           { type: 'string',  description: 'Date in YYYY-MM-DD format' },
        serviceId:      { type: 'integer', description: 'Service ID' },
        professionalId: { type: 'integer', description: 'Professional ID (optional)' },
      },
      required: ['date', 'serviceId'],
    },
  },
  {
    name: 'update_client',
    description: 'Update the client\'s name. Call when the client provides their name for the first time before confirming an appointment.',
    input_schema: {
      type: 'object',
      properties: {
        clientId: { type: 'integer', description: 'Client ID' },
        name:     { type: 'string',  description: 'Client name or nickname' },
      },
      required: ['clientId', 'name'],
    },
  },
  {
    name: 'create_appointment',
    description: 'Book an appointment. Only call after the client has confirmed service, professional, date, and time.',
    input_schema: {
      type: 'object',
      properties: {
        clientId:       { type: 'integer' },
        professionalId: { type: 'integer' },
        serviceId:      { type: 'integer' },
        scheduledAt:    { type: 'string', description: 'Format: YYYY-MM-DDTHH:MM:00' },
        address:        { type: 'string', description: 'Client address (required for on-site services)' },
        notes:          { type: 'string', description: 'Additional notes (equipment, reported issue, etc.)' },
      },
      required: ['clientId', 'professionalId', 'serviceId', 'scheduledAt'],
    },
  },
  {
    name: 'notify_admin',
    description: 'Notify the administrator about a situation that requires attention, without interrupting the conversation with the client. Use when: the client cannot pay digitally, a payment receipt is received, there is a complaint, the service has no price, the service cannot be identified, the client has a query outside the agent\'s scope, or any situation the admin should know about. The bot continues responding normally after calling this function.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Brief description of what happened' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'delegate_to_admin',
    description: 'Transfer the conversation to the human administrator and stop the bot from responding. Use ONLY when the client explicitly asks to speak with a real person.',
    input_schema: {
      type: 'object',
      properties: {
        reason:      { type: 'string', description: 'Full summary of the conversation: what the client asked, what was offered, why handoff is needed. Be specific — the admin will use this to contact the client directly.' },
        clientName:  { type: 'string', description: 'Client name if known' },
        clientPhone: { type: 'string', description: 'Client phone number if known' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'get_client_appointments',
    description: 'List the client\'s pending appointments.',
    input_schema: {
      type: 'object',
      properties: {
        clientId: { type: 'integer' },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment. Only after the client has confirmed they want to cancel.',
    input_schema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'integer' },
      },
      required: ['appointmentId'],
    },
  },
  {
    name: 'get_professionals',
    description: 'List the active professionals of the business. Use when the client asks for a specific professional by name.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

module.exports = { TOOLS };
