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
    name: 'actualizar_cliente',
    description: 'Actualiza el nombre de un cliente. Llamar cuando el cliente proporciona su nombre por primera vez antes de confirmar un turno.',
    input_schema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'integer', description: 'ID del cliente' },
        nombre:     { type: 'string',  description: 'Nombre o apodo del cliente' },
      },
      required: ['cliente_id', 'nombre'],
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
        observaciones:  { type: 'string', description: 'Notas adicionales del turno (equipo, problema reportado, etc.)' },
      },
      required: ['cliente_id', 'profesional_id', 'servicio_id', 'fecha_hora'],
    },
  },
  {
    name: 'notificar_admin',
    description: 'Notifica al administrador sobre una situación que requiere su atención, sin interrumpir la conversación con el cliente. Usar cuando: el cliente no puede pagar digitalmente, se recibe un comprobante de pago, hay una queja, el servicio no tiene precio, no se puede identificar el servicio, el cliente tiene una consulta fuera del alcance del agente, o cualquier situación que Jonatan deba saber. El bot sigue respondiendo normalmente después de llamar esta función.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Descripción breve de lo que ocurrió' },
      },
      required: ['motivo'],
    },
  },
  {
    name: 'derivar_a_admin',
    description: 'Transfiere la conversación al administrador humano y detiene las respuestas del bot. Usar ÚNICAMENTE cuando el cliente pide explícitamente hablar con una persona real.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Descripción breve del motivo' },
      },
      required: ['motivo'],
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
