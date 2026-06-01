'use strict';

const { Client } = require('../models');
const { notFound, badRequest, conflict } = require('../utils/errors');

async function getAll(businessId) {
  return Client.findAll({ where: { businessId }, order: [['name', 'ASC']] });
}

async function getById(businessId, id) {
  const client = await Client.findOne({ where: { id, businessId } });
  if (!client) throw notFound('Client not found');
  return client;
}

async function create(businessId, { name, phone, email }) {
  if (!name || !phone) throw badRequest('name and phone are required');

  const existing = await Client.findOne({ where: { businessId, phone } });
  if (existing) throw conflict(`A client with phone ${phone} already exists`);

  return Client.create({ businessId, name, phone, email });
}

async function update(businessId, id, { name, phone, email }) {
  const client = await getById(businessId, id);

  if (phone && phone !== client.phone) {
    const existing = await Client.findOne({ where: { businessId, phone } });
    if (existing) throw conflict(`A client with phone ${phone} already exists`);
  }

  await client.update({ name, phone, email });
  return client;
}

async function findOrCreate(businessId, { phone, name }) {
  if (!phone || !name) throw badRequest('phone and name are required');

  const existing = await Client.findOne({ where: { businessId, phone } });
  if (existing) return { ...existing.toJSON(), isNew: false };

  const created = await Client.create({ businessId, name, phone });
  return { ...created.toJSON(), isNew: true };
}

async function updateName(businessId, id, name) {
  const client = await Client.findOne({ where: { id, businessId } });
  if (!client) throw notFound('Client not found');
  await client.update({ name });
  return client;
}

module.exports = { getAll, getById, create, update, findOrCreate, updateName };
