'use strict';

const crypto = require('crypto');
const { Negocio } = require('../models');
const { notFound, badRequest } = require('../utils/errors');
const { validateSystemPrompt } = require('./utils/nombre');

const PUBLIC_ATTRIBUTES = ['id', 'nombre', 'rubro', 'whatsapp_number', 'activo', 'agente_nombre', 'system_prompt', 'admin_phone', 'created_at'];

async function getAll() {
  return Negocio.findAll({ attributes: PUBLIC_ATTRIBUTES, order: [['nombre', 'ASC']] });
}

async function getById(id) {
  const negocio = await Negocio.findByPk(id, { attributes: PUBLIC_ATTRIBUTES });
  if (!negocio) throw notFound('Negocio not found');
  return negocio;
}

async function create({ nombre, rubro, whatsapp_number, agente_nombre, system_prompt, admin_phone }) {
  if (!nombre || !rubro) throw badRequest('nombre and rubro are required');
  validateSystemPrompt(system_prompt);
  const api_key = 'sk_' + crypto.randomBytes(24).toString('hex');
  const negocio = await Negocio.create({
    nombre,
    rubro,
    whatsapp_number: whatsapp_number ?? null,
    api_key,
    agente_nombre:   agente_nombre ?? null,
    system_prompt:   system_prompt ?? null,
    admin_phone:     admin_phone ?? null,
  });
  return negocio;
}

async function update(id, { nombre, rubro, whatsapp_number, activo, agente_nombre, system_prompt, admin_phone }) {
  if (system_prompt !== undefined) validateSystemPrompt(system_prompt);
  const negocio = await Negocio.findByPk(id);
  if (!negocio) throw notFound('Negocio not found');
  await negocio.update({ nombre, rubro, whatsapp_number, activo, agente_nombre, system_prompt, admin_phone });
  return negocio.reload({ attributes: PUBLIC_ATTRIBUTES });
}

module.exports = { getAll, getById, create, update };
