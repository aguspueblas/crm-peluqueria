'use strict';

const { Op } = require('sequelize');
const { Servicio, Turno } = require('../models');
const { notFound, badRequest, conflict } = require('../utils/errors');

async function getAll(negocio_id) {
  return Servicio.findAll({
    where:      { negocio_id },
    attributes: ['id', 'nombre', 'duracion_minutos', 'precio'],
    order:      [['nombre', 'ASC']],
  });
}

async function create(negocio_id, { nombre, duracion_minutos, precio }) {
  if (!nombre || !duracion_minutos) throw badRequest('nombre and duracion_minutos are required');
  if (!Number.isInteger(duracion_minutos) || duracion_minutos <= 0)
    throw badRequest('duracion_minutos must be a positive integer');
  return Servicio.create({ negocio_id, nombre, duracion_minutos, precio: precio ?? null });
}

async function update(negocio_id, id, { nombre, duracion_minutos, precio }) {
  const servicio = await findOwned(negocio_id, id);
  if (duracion_minutos !== undefined) {
    if (!Number.isInteger(duracion_minutos) || duracion_minutos <= 0)
      throw badRequest('duracion_minutos must be a positive integer');
  }
  await servicio.update({ nombre, duracion_minutos, precio });
  return servicio;
}

async function remove(negocio_id, id) {
  const servicio = await findOwned(negocio_id, id);
  const active = await Turno.count({
    where: { servicio_id: id, estado: { [Op.in]: ['pendiente', 'confirmado'] } },
  });
  if (active > 0) throw conflict('There are active appointments linked to this service');
  await servicio.destroy();
}

async function findOwned(negocio_id, id) {
  const servicio = await Servicio.findOne({ where: { id, negocio_id } });
  if (!servicio) throw notFound('Service not found');
  return servicio;
}

module.exports = { getAll, create, update, remove };
