'use strict';

const { runLoop }        = require('./run-loop');
const { ADMIN_TOOLS }   = require('./admin-tools');
const { execute }       = require('./admin-executor');
const { buildAdminPrompt } = require('./admin-prompt');
const adminStore        = require('../conversation/admin-store');

async function run({ business, adminUser, message }) {
  return runLoop({
    business,
    from:        adminUser.telefono,
    message,
    tools:       ADMIN_TOOLS,
    execute,
    buildPrompt: (b, from) => buildAdminPrompt(b, from),
    store: {
      load:  (businessId, from) => adminStore.load(adminUser.id, businessId),
      save:  (businessId, from, messages) => adminStore.save(adminUser.id, businessId, messages),
      prune: adminStore.prune,
    },
    maxTokens: 768,
  });
}

module.exports = { run };
