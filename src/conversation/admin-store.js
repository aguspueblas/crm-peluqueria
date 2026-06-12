'use strict';

const { Op } = require('sequelize');
const { AdminConversation } = require('../models');

const MAX_HISTORY           = 10;
const TTL_MS                = 7 * 24 * 60 * 60 * 1000; // 7 days

async function load(adminUserId, businessId) {
  const conv = await AdminConversation.findOne({ where: { adminUserId, businessId } });
  return conv?.messages ?? [];
}

async function save(adminUserId, businessId, messages) {
  const existing = await AdminConversation.findOne({ where: { adminUserId, businessId } });
  if (existing) {
    await existing.update({ messages });
  } else {
    await AdminConversation.create({ adminUserId, businessId, messages });
  }
}

function prune(messages) {
  return messages.slice(-MAX_HISTORY);
}

async function cleanup() {
  const cutoff  = new Date(Date.now() - TTL_MS);
  const deleted = await AdminConversation.destroy({ where: { updated_at: { [Op.lt]: cutoff } } });
  if (deleted > 0) console.log(`[admin-store] cleaned up ${deleted} expired admin conversation(s)`);
}

function startCleanupScheduler() {
  setInterval(cleanup, 60 * 60 * 1000); // check hourly
}

module.exports = { load, save, prune, startCleanupScheduler };
