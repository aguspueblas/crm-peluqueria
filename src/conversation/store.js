'use strict';

const { Op } = require('sequelize');
const { Conversation } = require('../models');

const MAX_HISTORY = 10;
const INACTIVE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

async function load(businessId, phone) {
  const conv = await Conversation.findOne({ where: { businessId, phone } });
  return conv?.messages ?? [];
}

async function save(businessId, phone, messages) {
  const existing = await Conversation.findOne({ where: { businessId, phone } });
  if (existing) {
    await existing.update({ messages });
  } else {
    await Conversation.create({ businessId, phone, messages });
  }
}

async function getStatus(businessId, phone) {
  const conv = await Conversation.findOne({ where: { businessId, phone } });
  return conv?.status ?? 'active';
}

async function markDelegated(businessId, phone) {
  const existing = await Conversation.findOne({ where: { businessId, phone } });
  if (existing) {
    await existing.update({ status: 'derivada' });
  } else {
    await Conversation.create({ businessId, phone, messages: [], status: 'derivada' });
  }
}

function prune(messages) {
  return messages.slice(-MAX_HISTORY);
}

async function cleanup() {
  const cutoff = new Date(Date.now() - INACTIVE_THRESHOLD_MS);
  const deleted = await Conversation.destroy({ where: { updated_at: { [Op.lt]: cutoff } } });
  if (deleted > 0) console.log(`[store] cleaned up ${deleted} inactive conversation(s)`);
}

function startCleanupScheduler() {
  setInterval(cleanup, 30 * 60 * 1000);
}

module.exports = { load, save, prune, getStatus, markDelegated, startCleanupScheduler };
