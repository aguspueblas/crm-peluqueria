'use strict';

const { Op } = require('sequelize');
const { Conversacion } = require('../models');

const MAX_HISTORY = 10;

async function load(negocio_id, telefono) {
  const conv = await Conversacion.findOne({ where: { negocio_id, telefono } });
  return conv?.messages ?? [];
}

async function save(negocio_id, telefono, messages) {
  const existing = await Conversacion.findOne({ where: { negocio_id, telefono } });
  if (existing) {
    await existing.update({ messages });
  } else {
    await Conversacion.create({ negocio_id, telefono, messages });
  }
}

async function getEstado(negocio_id, telefono) {
  const conv = await Conversacion.findOne({ where: { negocio_id, telefono } });
  return conv?.estado ?? 'activa';
}

async function marcarDerivada(negocio_id, telefono) {
  const existing = await Conversacion.findOne({ where: { negocio_id, telefono } });
  if (existing) {
    await existing.update({ estado: 'derivada' });
  } else {
    await Conversacion.create({ negocio_id, telefono, messages: [], estado: 'derivada' });
  }
}

function prune(messages) {
  return messages.slice(-MAX_HISTORY);
}

async function cleanup() {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await Conversacion.destroy({ where: { updated_at: { [Op.lt]: cutoff } } });
}

setInterval(cleanup, 30 * 60 * 1000);

module.exports = { load, save, prune, getEstado, marcarDerivada };
