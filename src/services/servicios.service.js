'use strict';

const { Op } = require('sequelize');
const { Servicio, Turno } = require('../models');

async function getAll(negocio_id) {
  return Servicio.findAll({ where: { negocio_id }, order: [['nombre', 'ASC']] });
}

async function create(negocio_id, { nombre, duracion_minutos, precio }) {
  if (!nombre || !duracion_minutos) throw badRequest('nombre y duracion_minutos son requeridos');
  if (!Number.isInteger(duracion_minutos) || duracion_minutos <= 0 || duracion_minutos % 30 !== 0)
    throw badRequest('duracion_minutos debe ser un múltiplo positivo de 30');
  return Servicio.create({ negocio_id, nombre, duracion_minutos, precio: precio ?? null });
}

async function update(negocio_id, id, { nombre, duracion_minutos, precio }) {
  const servicio = await findOwned(negocio_id, id);
  if (duracion_minutos !== undefined) {
    if (!Number.isInteger(duracion_minutos) || duracion_minutos <= 0 || duracion_minutos % 30 !== 0)
      throw badRequest('duracion_minutos debe ser un múltiplo positivo de 30');
  }
  await servicio.update({ nombre, duracion_minutos, precio });
  return servicio;
}

async function remove(negocio_id, id) {
  const servicio = await findOwned(negocio_id, id);
  const activos = await Turno.count({
    where: { servicio_id: id, estado: { [Op.in]: ['pendiente', 'confirmado'] } },
  });
  if (activos > 0) throw conflict('Existen turnos asociados a este servicio');
  await servicio.destroy();
}

async function findOwned(negocio_id, id) {
  const servicio = await Servicio.findOne({ where: { id, negocio_id } });
  if (!servicio) throw notFound('Servicio no encontrado');
  return servicio;
}

function notFound(msg) { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }
function conflict(msg)  { const e = new Error(msg); e.status = 409; return e; }

module.exports = { getAll, create, update, remove };
