'use strict';

const crypto = require('crypto');
const { Negocio } = require('../models');
const { notFound, badRequest } = require('../utils/errors');

const PUBLIC_ATTRIBUTES = ['id', 'nombre', 'rubro', 'activo', 'created_at'];

async function getAll() {
  return Negocio.findAll({ attributes: PUBLIC_ATTRIBUTES, order: [['nombre', 'ASC']] });
}

async function getById(id) {
  const negocio = await Negocio.findByPk(id, { attributes: PUBLIC_ATTRIBUTES });
  if (!negocio) throw notFound('Negocio not found');
  return negocio;
}

async function create({ nombre, rubro }) {
  if (!nombre || !rubro) throw badRequest('nombre and rubro are required');
  const api_key = 'sk_' + crypto.randomBytes(24).toString('hex');
  const negocio = await Negocio.create({ nombre, rubro, api_key });
  // api_key is returned only on creation — the caller must save it
  return negocio;
}

async function update(id, { nombre, rubro, activo }) {
  const negocio = await Negocio.findByPk(id);
  if (!negocio) throw notFound('Negocio not found');
  await negocio.update({ nombre, rubro, activo });
  return negocio.reload({ attributes: PUBLIC_ATTRIBUTES });
}

module.exports = { getAll, getById, create, update };
