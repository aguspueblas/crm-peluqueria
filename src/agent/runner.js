'use strict';

const { runLoop }                                = require('./run-loop');
const { TOOLS }                                  = require('./tools');
const { execute }                                = require('./executor');
const { buildSystemPrompt }                      = require('./prompt');
const store                                      = require('../conversation/store');
const { notifyDelegation, notifyNewAppointment } = require('../services/notifications.service');
const adminService                               = require('../services/admin.service');

async function run({ business, from, senderName, message }) {
  const adminPhones = await adminService.getAdminPhones(business.id);

  const onSpecialTool = async ({ toolName, input, result }) => {
    if (toolName === 'notify_admin') {
      notifyDelegation(business, from, input.reason ?? '', adminPhones).catch(err =>
        console.error(`[runner] notify_admin failed: ${err.message}`)
      );
    }
    if (toolName === 'create_appointment' && !result.error) {
      notifyNewAppointment(business, result, adminPhones).catch(err =>
        console.error(`[runner] notify_new_appointment failed: ${err.message}`)
      );
    }
    if (toolName === 'delegate_to_admin') {
      await store.markDelegated(business.id, from);
      notifyDelegation(business, from, input.reason ?? '', adminPhones).catch(err =>
        console.error(`[runner] delegate notification failed: ${err.message}`)
      );
      return { delegated: true };
    }
    return { delegated: false };
  };

  return runLoop({
    business,
    from,
    message,
    tools:        TOOLS,
    execute,
    buildPrompt:  (b, f) => buildSystemPrompt(b, senderName, f),
    store,
    onSpecialTool,
  });
}

module.exports = { run };
