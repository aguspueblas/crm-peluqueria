'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { Turno, Cliente, Profesional, Servicio } = require('../models');
const { notFound, badRequest, conflict, unprocessable } = require('../utils/errors');

const INCLUDE_DETALLE = [
  { model: Cliente,     attributes: ['id', 'nombre', 'telefono'] },
  { model: Profesional, attributes: ['id', 'nombre'] },
  { model: Servicio,    attributes: ['id', 'nombre', 'duracion_minutos', 'precio'] },
];

const TRANSICIONES = {
  pendiente:  ['confirmado', 'cancelado'],
  confirmado: ['cancelado'],
  cancelado:  [],
};

async function getAll(negocio_id, { fecha, profesional_id, cliente_id, estado } = {}) {
  const where = { negocio_id };
  if (fecha) {
    where.fecha_hora = {
      [Op.gte]: new Date(`${fecha}T00:00:00`),
      [Op.lte]: new Date(`${fecha}T23:59:59`),
    };
  }
  if (profesional_id) where.profesional_id = profesional_id;
  if (cliente_id)     where.cliente_id     = cliente_id;
  if (estado)         where.estado         = estado;

  return Turno.findAll({ where, include: INCLUDE_DETALLE, order: [['fecha_hora', 'ASC']] });
}

async function getById(negocio_id, id) {
  const turno = await Turno.findOne({ where: { id, negocio_id }, include: INCLUDE_DETALLE });
  if (!turno) throw notFound('Appointment not found');
  return turno;
}

async function create(negocio_id, { cliente_id, profesional_id, servicio_id, fecha_hora }) {
  if (!cliente_id || !profesional_id || !servicio_id || !fecha_hora)
    throw badRequest('cliente_id, profesional_id, servicio_id and fecha_hora are required');

  if (new Date(fecha_hora) <= new Date())
    throw badRequest('Appointment date must be in the future');

  const [cliente, profesional, servicio] = await Promise.all([
    Cliente.findOne({ where: { id: cliente_id, negocio_id } }),
    Profesional.findOne({ where: { id: profesional_id, negocio_id } }),
    Servicio.findOne({ where: { id: servicio_id, negocio_id } }),
  ]);

  if (!cliente)     throw notFound('Client not found');
  if (!profesional) throw notFound('Professional not found');
  if (!servicio)    throw notFound('Service not found');
  if (!profesional.activo) throw badRequest('The professional is not active');

  await checkDentroDeHorario(profesional_id, fecha_hora, servicio.duracion_minutos);
  await checkSolapamientos(negocio_id, profesional_id, cliente_id, fecha_hora, servicio.duracion_minutos, null);

  const turno = await Turno.create({ negocio_id, cliente_id, profesional_id, servicio_id, fecha_hora, estado: 'pendiente' });
  return getById(negocio_id, turno.id);
}

async function update(negocio_id, id, { fecha_hora, estado }) {
  const turno = await getById(negocio_id, id);

  if (estado !== undefined) {
    if (!TRANSICIONES[turno.estado].includes(estado))
      throw unprocessable(`Cannot transition from '${turno.estado}' to '${estado}'`);
  }

  if (fecha_hora !== undefined) {
    if (new Date(fecha_hora) <= new Date())
      throw badRequest('Appointment date must be in the future');

    const [servicio, profesional] = await Promise.all([
      Servicio.findByPk(turno.servicio_id),
      Profesional.findByPk(turno.profesional_id),
    ]);

    if (!profesional.activo) throw badRequest('The professional is not active');

    await checkDentroDeHorario(turno.profesional_id, fecha_hora, servicio.duracion_minutos);
    await checkSolapamientos(negocio_id, turno.profesional_id, turno.cliente_id, fecha_hora, servicio.duracion_minutos, id);
  }

  await turno.update({
    ...(fecha_hora !== undefined && { fecha_hora }),
    ...(estado    !== undefined && { estado }),
  });
  return getById(negocio_id, id);
}

async function cancel(negocio_id, id) {
  const turno = await getById(negocio_id, id);
  if (!TRANSICIONES[turno.estado].includes('cancelado'))
    throw unprocessable(`Cannot cancel an appointment with status '${turno.estado}'`);
  await turno.update({ estado: 'cancelado' });
}

// Uses a raw query with AT TIME ZONE to avoid process-timezone dependency
async function checkDentroDeHorario(profesional_id, fecha_hora, duracion_minutos) {
  const inicio = new Date(fecha_hora).toISOString();
  const fin    = new Date(new Date(fecha_hora).getTime() + duracion_minutos * 60000).toISOString();

  const result = await sequelize.query(
    `SELECT id FROM profesional_horarios
     WHERE profesional_id = :profesional_id
       AND dia_semana = EXTRACT(DOW FROM :inicio::timestamptz AT TIME ZONE 'America/Buenos_Aires')
       AND hora_inicio <= (:inicio::timestamptz AT TIME ZONE 'America/Buenos_Aires')::time
       AND hora_fin    >= (:fin::timestamptz    AT TIME ZONE 'America/Buenos_Aires')::time
     LIMIT 1`,
    { replacements: { profesional_id, inicio, fin }, type: sequelize.QueryTypes.SELECT }
  );

  if (result.length === 0)
    throw badRequest('The appointment is outside the professional\'s working hours');
}

async function checkSolapamientos(negocio_id, profesional_id, cliente_id, fecha_hora, duracion_minutos, excluir_id) {
  const inicio = new Date(fecha_hora).toISOString();
  const fin    = new Date(new Date(fecha_hora).getTime() + duracion_minutos * 60000).toISOString();
  const params = { negocio_id, profesional_id, cliente_id, fecha_hora: inicio, fin, excluir_id: excluir_id ?? null };

  const solapado = await sequelize.query(
    `SELECT t.id, t.profesional_id, t.cliente_id FROM turnos t
     JOIN servicios s ON s.id = t.servicio_id
     WHERE t.negocio_id = :negocio_id
       AND t.estado IN ('pendiente', 'confirmado')
       AND (:excluir_id IS NULL OR t.id != :excluir_id)
       AND t.fecha_hora < :fin::timestamptz
       AND t.fecha_hora + (s.duracion_minutos || ' minutes')::interval > :fecha_hora::timestamptz
       AND (t.profesional_id = :profesional_id OR t.cliente_id = :cliente_id)
     LIMIT 2`,
    { replacements: params, type: sequelize.QueryTypes.SELECT }
  );

  for (const row of solapado) {
    if (row.profesional_id === parseInt(profesional_id))
      throw conflict('The professional already has an appointment at that time');
    if (row.cliente_id === parseInt(cliente_id))
      throw conflict('The client already has an appointment at that time');
  }
}

module.exports = { getAll, getById, create, update, cancel };
