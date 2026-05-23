'use strict';

const { Cliente } = require('../models');
const { notFound, badRequest, conflict } = require('../utils/errors');

async function getAll(negocio_id) {
  return Cliente.findAll({ where: { negocio_id }, order: [['nombre', 'ASC']] });
}

async function getById(negocio_id, id) {
  const cliente = await Cliente.findOne({ where: { id, negocio_id } });
  if (!cliente) throw notFound('Client not found');
  return cliente;
}

async function create(negocio_id, { nombre, telefono, email }) {
  if (!nombre || !telefono) throw badRequest('nombre and telefono are required');

  const exists = await Cliente.findOne({ where: { negocio_id, telefono } });
  if (exists) throw conflict(`A client with phone ${telefono} already exists`);

  return Cliente.create({ negocio_id, nombre, telefono, email });
}

async function update(negocio_id, id, { nombre, telefono, email }) {
  const cliente = await getById(negocio_id, id);

  if (telefono && telefono !== cliente.telefono) {
    const exists = await Cliente.findOne({ where: { negocio_id, telefono } });
    if (exists) throw conflict(`A client with phone ${telefono} already exists`);
  }

  await cliente.update({ nombre, telefono, email });
  return cliente;
}

async function identificar(negocio_id, { telefono, nombre }) {
  if (!telefono || !nombre) throw badRequest('telefono and nombre are required');

  const existing = await Cliente.findOne({ where: { negocio_id, telefono } });
  if (existing) return { ...existing.toJSON(), es_nuevo: false };

  const nuevo = await Cliente.create({ negocio_id, nombre, telefono });
  return { ...nuevo.toJSON(), es_nuevo: true };
}

async function updateNombre(negocio_id, id, nombre) {
  const cliente = await Cliente.findOne({ where: { id, negocio_id } });
  if (!cliente) throw notFound('Client not found');
  await cliente.update({ nombre });
  return cliente;
}

module.exports = { getAll, getById, create, update, identificar, updateNombre };
