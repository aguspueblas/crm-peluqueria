'use strict';

const crypto = require('crypto');
const { Negocio } = require('../models');

async function getAll() {
  return Negocio.findAll({ order: [['nombre', 'ASC']] });
}

async function getById(id) {
  const negocio = await Negocio.findByPk(id);
  if (!negocio) throw notFound('Negocio no encontrado');
  return negocio;
}

async function create({ nombre, rubro }) {
  if (!nombre || !rubro) throw badRequest('nombre y rubro son requeridos');
  const api_key = 'sk_' + crypto.randomBytes(24).toString('hex');
  return Negocio.create({ nombre, rubro, api_key });
}

async function update(id, { nombre, rubro, activo }) {
  const negocio = await getById(id);
  await negocio.update({ nombre, rubro, activo });
  return negocio;
}

function notFound(msg) { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }

module.exports = { getAll, getById, create, update };
