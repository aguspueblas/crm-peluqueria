'use strict';

const ADMIN_TOOLS = [
  {
    name: 'get_appointments',
    description: 'List appointments for the business. Defaults to today if no date provided.',
    input_schema: {
      type: 'object',
      properties: {
        date:           { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today in Argentina)' },
        status:         { type: 'string', enum: ['pendiente', 'confirmado', 'cancelado'], description: 'Filter by status' },
        professionalId: { type: 'integer', description: 'Filter by professional' },
      },
    },
  },
  {
    name: 'get_appointment_detail',
    description: 'Get full details of a single appointment including client info, address, and notes.',
    input_schema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'integer', description: 'Appointment ID' },
      },
      required: ['appointmentId'],
    },
  },
  {
    name: 'create_appointment',
    description: 'Manually create an appointment. clientPhone is used to find or create the client.',
    input_schema: {
      type: 'object',
      properties: {
        clientPhone:    { type: 'string', description: 'Client phone number (find-or-create)' },
        clientName:     { type: 'string', description: 'Client name (used when creating a new client)' },
        professionalId: { type: 'integer', description: 'Professional ID' },
        serviceId:      { type: 'integer', description: 'Service ID' },
        scheduledAt:    { type: 'string', description: 'Date and time in ISO 8601 format (e.g. 2026-06-15T14:00:00)' },
        address:        { type: 'string', description: 'Service address (for on-site services)' },
        notes:          { type: 'string', description: 'Internal notes' },
      },
      required: ['clientPhone', 'professionalId', 'serviceId', 'scheduledAt'],
    },
  },
  {
    name: 'update_appointment',
    description: 'Reschedule an appointment or update its notes.',
    input_schema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'integer', description: 'Appointment ID' },
        scheduledAt:   { type: 'string', description: 'New date and time in ISO 8601 format' },
        notes:         { type: 'string', description: 'Updated internal notes' },
      },
      required: ['appointmentId'],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an appointment.',
    input_schema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'integer', description: 'Appointment ID' },
      },
      required: ['appointmentId'],
    },
  },
  {
    name: 'confirm_appointment',
    description: 'Confirm a pending appointment.',
    input_schema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'integer', description: 'Appointment ID' },
      },
      required: ['appointmentId'],
    },
  },
  {
    name: 'get_availability',
    description: 'Check available slots for a service. If no date provided, defaults to today in Argentina.',
    input_schema: {
      type: 'object',
      properties: {
        serviceId:      { type: 'integer', description: 'Service ID' },
        date:           { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' },
        professionalId: { type: 'integer', description: 'Filter by professional' },
      },
      required: ['serviceId'],
    },
  },
  {
    name: 'get_services',
    description: 'List all services offered by the business including duration and price.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

module.exports = { ADMIN_TOOLS };
