'use strict';

const crypto = require('crypto');
const { Business } = require('../models');
const { notFound, badRequest } = require('../utils/errors');
const { validateSystemPrompt } = require('./utils/client-name');

const PUBLIC_ATTRIBUTES = ['id', 'name', 'sector', 'whatsappNumber', 'active', 'agentName', 'systemPrompt', 'createdAt'];

async function getAll() {
  return Business.findAll({ attributes: PUBLIC_ATTRIBUTES, order: [['name', 'ASC']] });
}

async function getById(id) {
  const business = await Business.findByPk(id, { attributes: PUBLIC_ATTRIBUTES });
  if (!business) throw notFound('Business not found');
  return business;
}

async function create({ name, sector, whatsappNumber, agentName, systemPrompt }) {
  if (!name || !sector) throw badRequest('name and sector are required');
  validateSystemPrompt(systemPrompt);
  const apiKey = 'sk_' + crypto.randomBytes(24).toString('hex');
  return Business.create({
    name,
    sector,
    whatsappNumber: whatsappNumber ?? null,
    apiKey,
    agentName:    agentName ?? null,
    systemPrompt: systemPrompt ?? null,
  });
}

async function update(id, { name, sector, whatsappNumber, active, agentName, systemPrompt }) {
  if (systemPrompt !== undefined) validateSystemPrompt(systemPrompt);
  const business = await Business.findByPk(id);
  if (!business) throw notFound('Business not found');
  await business.update({ name, sector, whatsappNumber, active, agentName, systemPrompt });
  return business.reload({ attributes: PUBLIC_ATTRIBUTES });
}

module.exports = { getAll, getById, create, update };
