'use strict';

const TOOLS = [
  {
    name: 'get_services',
    description: 'List available services for the business (name, duration, price). Call at the start if the client has not specified a service.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_availability',
    description: 'Return available time slots for a service on a given date. Use before booking an appointment.',
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
        reason: { type: 'string', description: 'Brief description of the reason' },
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
