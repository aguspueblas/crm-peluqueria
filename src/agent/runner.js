'use strict';

const { runLoop }                                = require('./run-loop');
const { TOOLS }                                  = require('./tools');
const { execute }                                = require('./executor');
const { buildSystemPrompt }                      = require('./prompt');
const store                                      = require('../conversation/store');
const adminStore                                 = require('../conversation/admin-store');
const { notifyDelegation, notifyNewAppointment, notifyBotError } = require('../services/notifications.service');
const adminService                               = require('../services/admin.service');

async function run({ business, from, senderName, message }) {
  const admins      = await adminService.getAdmins(business.id);
  const adminPhones = admins.map(a => a.telefono);

  let delegated = false;

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

      const clientName  = input.clientName  ?? null;
      const clientPhone = input.clientPhone ?? from;
      const reason      = input.reason ?? '';

      // Inject delegation notice into each admin's conversation history
      for (const admin of admins) {
        try {
          const history = await adminStore.load(admin.id, business.id);
          const clientLabel = clientName ? `${clientName} (${clientPhone})` : clientPhone;
          const notifText = `[Derivación — ${business.name}] ${clientLabel} solicitó atención personal.\n\nContexto: ${reason}`;
          history.push({ role: 'user',      content: notifText });
          history.push({ role: 'assistant', content: 'Entendido. El cliente fue derivado para atención personal.' });
          await adminStore.save(admin.id, business.id, history);
        } catch (err) {
          console.error(`[runner] admin history inject failed admin=${admin.id}: ${err.message}`);
        }
      }

      delegated = true;
      notifyDelegation(business, clientPhone, reason, adminPhones, clientName).catch(err =>
        console.error(`[runner] delegate notification failed: ${err.message}`)
      );
      return { delegated: true };
    }
    return { delegated: false };
  };

  const reply = await runLoop({
    business,
    from,
    message,
    tools:               TOOLS,
    execute,
    buildPrompt:         (b, f) => buildSystemPrompt(b, senderName, f),
    store,
    onSpecialTool,
    finalTurnOnDelegate: false,
  });

  if (reply === null && !delegated) {
    notifyBotError(business, from, adminPhones).catch(err =>
      console.error(`[runner] bot error notify failed: ${err.message}`)
    );
  }

  return reply;
}

module.exports = { run };
