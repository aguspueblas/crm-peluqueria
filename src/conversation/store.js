'use strict';

const { Op } = require('sequelize');
const { Conversation } = require('../models');

const MAX_HISTORY            = 10;
const INACTIVE_THRESHOLD_MS  = 2 * 60 * 60 * 1000;       // 2 hours — active conversations
const DELEGATED_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days  — delegated conversations

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

async function unblock(businessId, phone) {
  await Conversation.destroy({ where: { businessId, phone } });
}

function prune(messages) {
  return messages.slice(-MAX_HISTORY);
}

async function cleanup() {
  const activeCutoff    = new Date(Date.now() - INACTIVE_THRESHOLD_MS);
  const delegatedCutoff = new Date(Date.now() - DELEGATED_THRESHOLD_MS);

  const [deletedActive, deletedDelegated] = await Promise.all([
    Conversation.destroy({
      where: { status: { [Op.ne]: 'derivada' }, updated_at: { [Op.lt]: activeCutoff } },
    }),
    Conversation.destroy({
      where: { status: 'derivada', updated_at: { [Op.lt]: delegatedCutoff } },
    }),
  ]);

  if (deletedActive > 0)    console.log(`[store] cleaned up ${deletedActive} inactive conversation(s)`);
  if (deletedDelegated > 0) console.log(`[store] auto-unblocked ${deletedDelegated} delegated conversation(s) after 7 days`);
}

function startCleanupScheduler() {
  setInterval(cleanup, 30 * 60 * 1000);
}

module.exports = { load, save, prune, getStatus, markDelegated, unblock, startCleanupScheduler };
