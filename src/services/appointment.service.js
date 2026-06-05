'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { Appointment, Client, Professional, Service } = require('../models');
const { notFound, badRequest, conflict, unprocessable } = require('../utils/errors');

const INCLUDE_DETAILS = [
  { model: Client,       attributes: ['id', 'name', 'phone'] },
  { model: Professional, attributes: ['id', 'name'] },
  { model: Service,      attributes: ['id', 'name', 'durationMinutes', 'price'] },
];

const STATUS_TRANSITIONS = {
  pendiente:  ['confirmado', 'cancelado'],
  confirmado: ['cancelado'],
  cancelado:  [],
};

async function getAll(businessId, { date, professionalId, clientId, status } = {}) {
  const where = { businessId };
  if (date) {
    where.scheduledAt = {
      [Op.gte]: new Date(`${date}T00:00:00`),
      [Op.lte]: new Date(`${date}T23:59:59`),
    };
  }
  if (professionalId) where.professionalId = professionalId;
  if (clientId)       where.clientId       = clientId;
  if (status)         where.status         = status;

  return Appointment.findAll({ where, include: INCLUDE_DETAILS, order: [['scheduledAt', 'ASC']] });
}

async function getById(businessId, id) {
  const appointment = await Appointment.findOne({ where: { id, businessId }, include: INCLUDE_DETAILS });
  if (!appointment) throw notFound('Appointment not found');
  return appointment;
}

async function create(businessId, { clientId, professionalId, serviceId, scheduledAt, address, notes }) {
  if (!clientId || !professionalId || !serviceId || !scheduledAt)
    throw badRequest('clientId, professionalId, serviceId and scheduledAt are required');

  if (new Date(scheduledAt) <= new Date())
    throw badRequest('Appointment date must be in the future');

  const [client, professional, service] = await Promise.all([
    Client.findOne({ where: { id: clientId, businessId } }),
    Professional.findOne({ where: { id: professionalId, businessId } }),
    Service.findOne({ where: { id: serviceId, businessId } }),
  ]);

  if (!client)       throw notFound('Client not found');
  if (!professional) throw notFound('Professional not found');
  if (!service)      throw notFound('Service not found');
  if (!professional.active) throw badRequest('The professional is not active');

  await checkWithinSchedule(professionalId, scheduledAt, service.durationMinutes);
  await checkOverlaps(businessId, professionalId, clientId, scheduledAt, service.durationMinutes, null);

  const appointment = await Appointment.create({
    businessId,
    clientId,
    professionalId,
    serviceId,
    scheduledAt,
    address: address ?? null,
    notes:   notes   ?? null,
    status: 'pendiente',
  });
  return getById(businessId, appointment.id);
}

async function update(businessId, id, { scheduledAt, status }) {
  const appointment = await getById(businessId, id);

  if (status !== undefined) {
    if (!STATUS_TRANSITIONS[appointment.status].includes(status))
      throw unprocessable(`Cannot transition from '${appointment.status}' to '${status}'`);
  }

  if (scheduledAt !== undefined) {
    if (new Date(scheduledAt) <= new Date())
      throw badRequest('Appointment date must be in the future');

    const [service, professional] = await Promise.all([
      Service.findByPk(appointment.serviceId),
      Professional.findByPk(appointment.professionalId),
    ]);

    if (!professional.active) throw badRequest('The professional is not active');

    await checkWithinSchedule(appointment.professionalId, scheduledAt, service.durationMinutes);
    await checkOverlaps(businessId, appointment.professionalId, appointment.clientId, scheduledAt, service.durationMinutes, id);
  }

  await appointment.update({
    ...(scheduledAt !== undefined && { scheduledAt }),
    ...(status      !== undefined && { status }),
  });
  return getById(businessId, id);
}

async function cancel(businessId, id) {
  const appointment = await getById(businessId, id);
  if (!STATUS_TRANSITIONS[appointment.status].includes('cancelado'))
    throw unprocessable(`Cannot cancel an appointment with status '${appointment.status}'`);
  await appointment.update({ status: 'cancelado' });
}

async function checkWithinSchedule(professionalId, scheduledAt, durationMinutes) {
  const result = await sequelize.query(
    `SELECT id FROM profesional_horarios
     WHERE profesional_id = :professionalId
       AND dia_semana = EXTRACT(DOW FROM :scheduledAt::timestamptz AT TIME ZONE 'America/Argentina/Buenos_Aires')
       AND hora_inicio <= (:scheduledAt::timestamptz AT TIME ZONE 'America/Argentina/Buenos_Aires')::time
       AND hora_fin    >= ((:scheduledAt::timestamptz AT TIME ZONE 'America/Argentina/Buenos_Aires') + :duration * INTERVAL '1 minute')::time
     LIMIT 1`,
    {
      replacements: { professionalId, scheduledAt, duration: durationMinutes },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  if (result.length === 0)
    throw badRequest('The appointment is outside the professional\'s working hours');
}

async function checkOverlaps(businessId, professionalId, clientId, scheduledAt, durationMinutes, excludeId) {
  const start = new Date(scheduledAt).toISOString();
  const end   = new Date(new Date(scheduledAt).getTime() + durationMinutes * 60000).toISOString();

  const overlapping = await sequelize.query(
    `SELECT t.id, t.profesional_id, t.cliente_id FROM turnos t
     JOIN servicios s ON s.id = t.servicio_id
     WHERE t.negocio_id = :businessId
       AND t.estado IN ('pendiente', 'confirmado')
       AND (:excludeId IS NULL OR t.id != :excludeId)
       AND t.fecha_hora < :end::timestamptz
       AND t.fecha_hora + (s.duracion_minutos || ' minutes')::interval > :start::timestamptz
       AND (t.profesional_id = :professionalId OR t.cliente_id = :clientId)
     LIMIT 2`,
    {
      replacements: { businessId, professionalId, clientId, start, end, excludeId: excludeId ?? null },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  for (const row of overlapping) {
    if (row.profesional_id === parseInt(professionalId))
      throw conflict('The professional already has an appointment at that time');
    if (row.cliente_id === parseInt(clientId))
      throw conflict('The client already has an appointment at that time');
  }
}

module.exports = { getAll, getById, create, update, cancel };
