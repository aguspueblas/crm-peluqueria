'use strict';

const TOOLS = [
  {
    name: 'get_servicios',
    description: 'Lista los servicios disponibles del negocio con nombre, duración y precio. Llamar al inicio si el cliente no especificó servicio.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_disponibilidad',
    description: 'Devuelve los horarios disponibles para un servicio en una fecha. Usar antes de reservar un turno.',
    input_schema: {
      type: 'object',
      properties: {
        fecha:          { type: 'string',  description: 'Fecha en formato YYYY-MM-DD' },
        servicio_id:    { type: 'integer', description: 'ID del servicio' },
        profesional_id: { type: 'integer', description: 'ID del profesional (opcional)' },
      },
      required: ['fecha', 'servicio_id'],
    },
  },
  {
    name: 'identificar_cliente',
    description: 'Encuentra o crea el cliente por su número de teléfono. Llamar al inicio de toda conversación.',
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre:   { type: 'string' },
      },
      required: ['telefono', 'nombre'],
    },
  },
  {
    name: 'crear_turno',
    description: 'Reserva un turno. Solo llamar después de que el cliente confirmó servicio, profesional, fecha y hora.',
    input_schema: {
      type: 'object',
      properties: {
        cliente_id:     { type: 'integer' },
        profesional_id: { type: 'integer' },
        servicio_id:    { type: 'integer' },
        fecha_hora:     { type: 'string', description: 'Formato: YYYY-MM-DDTHH:MM:00' },
        direccion:      { type: 'string', description: 'Dirección del cliente (requerida para servicios a domicilio)' },
      },
      required: ['cliente_id', 'profesional_id', 'servicio_id', 'fecha_hora'],
    },
  },
  {
    name: 'get_turnos_cliente',
    description: 'Lista los turnos pendientes del cliente.',
    input_schema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'integer' },
      },
      required: ['cliente_id'],
    },
  },
  {
    name: 'cancelar_turno',
    description: 'Cancela un turno existente. Solo después de que el cliente confirmó que quiere cancelar.',
    input_schema: {
      type: 'object',
      properties: {
        turno_id: { type: 'integer' },
      },
      required: ['turno_id'],
    },
  },
  {
    name: 'get_profesionales',
    description: 'Lista los profesionales activos del negocio. Usar cuando el cliente pide un profesional específico por nombre.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

module.exports = { TOOLS };
