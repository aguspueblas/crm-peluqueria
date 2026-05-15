'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { Turno, Cliente, Profesional, Servicio, ProfesionalHorario } = require('../models');

const INCLUDE_DETALLE = [
  { model: Cliente,     attributes: ['id', 'nombre', 'telefono'] },
  { model: Profesional, attributes: ['id', 'nombre'] },
  { model: Servicio,    attributes: ['id', 'nombre', 'duracion_minutos', 'precio'] },
];

const ESTADOS_ACTIVOS = ['pendiente', 'confirmado'];

const TRANSICIONES = {
  pendiente:  ['confirmado', 'cancelado'],
  confirmado: ['cancelado'],
  cancelado:  [],
};

async function getAll({ fecha, profesional_id, cliente_id, estado } = {}) {
  const where = {};

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

async function getById(id) {
  const turno = await Turno.findByPk(id, { include: INCLUDE_DETALLE });
  if (!turno) throw notFound('Turno no encontrado');
  return turno;
}

async function create({ cliente_id, profesional_id, servicio_id, fecha_hora }) {
  if (!cliente_id || !profesional_id || !servicio_id || !fecha_hora)
    throw badRequest('cliente_id, profesional_id, servicio_id y fecha_hora son requeridos');

  if (new Date(fecha_hora) <= new Date())
    throw badRequest('La fecha del turno debe ser en el futuro');

  const [cliente, profesional, servicio] = await Promise.all([
    Cliente.findByPk(cliente_id),
    Profesional.findByPk(profesional_id),
    Servicio.findByPk(servicio_id),
  ]);

  if (!cliente)     throw notFound('Cliente no encontrado');
  if (!profesional) throw notFound('Profesional no encontrado');
  if (!servicio)    throw notFound('Servicio no encontrado');
  if (!profesional.activo) throw badRequest('El profesional no está activo');

  await checkDentroDeHorario(profesional_id, fecha_hora, servicio.duracion_minutos);
  await checkSolapamientos(profesional_id, cliente_id, fecha_hora, servicio.duracion_minutos, null);

  const turno = await Turno.create({ cliente_id, profesional_id, servicio_id, fecha_hora, estado: 'pendiente' });
  return getById(turno.id);
}

async function update(id, { fecha_hora, estado }) {
  const turno = await getById(id);

  if (estado !== undefined) {
    if (!TRANSICIONES[turno.estado].includes(estado))
      throw unprocessable(`No se puede pasar de '${turno.estado}' a '${estado}'`);
  }

  if (fecha_hora !== undefined) {
    if (new Date(fecha_hora) <= new Date())
      throw badRequest('La fecha del turno debe ser en el futuro');

    const servicio = await Servicio.findByPk(turno.servicio_id);
    const profesional = await Profesional.findByPk(turno.profesional_id);

    if (!profesional.activo) throw badRequest('El profesional no está activo');

    await checkDentroDeHorario(turno.profesional_id, fecha_hora, servicio.duracion_minutos);
    await checkSolapamientos(turno.profesional_id, turno.cliente_id, fecha_hora, servicio.duracion_minutos, id);
  }

  await turno.update({ ...(fecha_hora && { fecha_hora }), ...(estado && { estado }) });
  return getById(id);
}

async function cancel(id) {
  const turno = await getById(id);
  if (!TRANSICIONES[turno.estado].includes('cancelado'))
    throw unprocessable(`No se puede cancelar un turno en estado '${turno.estado}'`);
  await turno.update({ estado: 'cancelado' });
}

async function checkDentroDeHorario(profesional_id, fecha_hora, duracion_minutos) {
  const fecha = new Date(fecha_hora);
  const dia_semana = fecha.getDay();
  const inicio = fecha.toTimeString().slice(0, 8);
  const fin = new Date(fecha.getTime() + duracion_minutos * 60000).toTimeString().slice(0, 8);

  const bloque = await ProfesionalHorario.findOne({
    where: {
      profesional_id,
      dia_semana,
      hora_inicio: { [Op.lte]: inicio },
      hora_fin:    { [Op.gte]: fin },
    },
  });

  if (!bloque) throw badRequest('El turno está fuera del horario de atención del profesional');
}

async function checkSolapamientos(profesional_id, cliente_id, fecha_hora, duracion_minutos, excluir_id) {
  const inicio = new Date(fecha_hora).toISOString();
  const fin = new Date(new Date(fecha_hora).getTime() + duracion_minutos * 60000).toISOString();
  const params = { profesional_id, cliente_id, fecha_hora: inicio, fin, excluir_id: excluir_id ?? null };

  const solapado = await sequelize.query(
    `SELECT t.id, t.profesional_id, t.cliente_id FROM turnos t
     JOIN servicios s ON s.id = t.servicio_id
     WHERE t.estado IN ('pendiente', 'confirmado')
       AND (:excluir_id IS NULL OR t.id != :excluir_id)
       AND t.fecha_hora < :fin::timestamptz
       AND t.fecha_hora + (s.duracion_minutos || ' minutes')::interval > :fecha_hora::timestamptz
       AND (t.profesional_id = :profesional_id OR t.cliente_id = :cliente_id)
     LIMIT 2`,
    { replacements: params, type: sequelize.QueryTypes.SELECT }
  );

  for (const row of solapado) {
    if (row.profesional_id === parseInt(profesional_id))
      throw conflict('El profesional ya tiene un turno en ese horario');
    if (row.cliente_id === parseInt(cliente_id))
      throw conflict('El cliente ya tiene un turno en ese horario');
  }
}

function notFound(msg)      { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg)    { const e = new Error(msg); e.status = 400; return e; }
function conflict(msg)      { const e = new Error(msg); e.status = 409; return e; }
function unprocessable(msg) { const e = new Error(msg); e.status = 422; return e; }

module.exports = { getAll, getById, create, update, cancel };
