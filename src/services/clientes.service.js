'use strict';

const { Cliente } = require('../models');

async function getAll(negocio_id) {
  return Cliente.findAll({ where: { negocio_id }, order: [['nombre', 'ASC']] });
}

async function getById(negocio_id, id) {
  const cliente = await Cliente.findOne({ where: { id, negocio_id } });
  if (!cliente) throw notFound('Cliente no encontrado');
  return cliente;
}

async function create(negocio_id, { nombre, telefono, email }) {
  if (!nombre || !telefono) throw badRequest('nombre y telefono son requeridos');

  const existe = await Cliente.findOne({ where: { negocio_id, telefono } });
  if (existe) throw conflict(`Ya existe un cliente con el teléfono ${telefono}`);

  return Cliente.create({ negocio_id, nombre, telefono, email });
}

async function update(negocio_id, id, { nombre, telefono, email }) {
  const cliente = await getById(negocio_id, id);

  if (telefono && telefono !== cliente.telefono) {
    const existe = await Cliente.findOne({ where: { negocio_id, telefono } });
    if (existe) throw conflict(`Ya existe un cliente con el teléfono ${telefono}`);
  }

  await cliente.update({ nombre, telefono, email });
  return cliente;
}

async function identificar(negocio_id, { telefono, nombre }) {
  if (!telefono || !nombre) throw badRequest('telefono y nombre son requeridos');

  const existente = await Cliente.findOne({ where: { negocio_id, telefono } });
  if (existente) return { ...existente.toJSON(), es_nuevo: false };

  const nuevo = await Cliente.create({ negocio_id, nombre, telefono });
  return { ...nuevo.toJSON(), es_nuevo: true };
}

function notFound(msg)  { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg){ const e = new Error(msg); e.status = 400; return e; }
function conflict(msg)  { const e = new Error(msg); e.status = 409; return e; }

module.exports = { getAll, getById, create, update, identificar };
