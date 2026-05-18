'use strict';

const { Op } = require('sequelize');
const { Conversacion } = require('../models');

const MAX_HISTORY = 10;

async function load(negocio_id, telefono) {
  const conv = await Conversacion.findOne({ where: { negocio_id, telefono } });
  return conv?.messages ?? [];
}

async function save(negocio_id, telefono, messages) {
  await Conversacion.upsert({ negocio_id, telefono, messages });
}

function prune(messages) {
  return messages.slice(-MAX_HISTORY);
}

async function cleanup() {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await Conversacion.destroy({ where: { updated_at: { [Op.lt]: cutoff } } });
}

setInterval(cleanup, 30 * 60 * 1000);

module.exports = { load, save, prune };
