'use strict';

const catalogService       = require('../services/catalog.service');
const availabilityService  = require('../services/availability.service');
const clientService        = require('../services/client.service');
const appointmentService   = require('../services/appointment.service');
const professionalService  = require('../services/professional.service');
const { validateClientName } = require('../services/utils/client-name');

async function execute(toolName, input, businessId) {
  try {
    switch (toolName) {
      case 'get_services':
        return await catalogService.getAll(businessId);

      case 'get_availability':
        return await availabilityService.getSlots(businessId, {
          date:           input.date,
          serviceId:      input.serviceId,
          professionalId: input.professionalId,
        });

      case 'update_client': {
        const validName = validateClientName(input.name);
        await clientService.updateName(businessId, input.clientId, validName);
        return { ok: true, name: validName };
      }

      case 'create_appointment':
        return await appointmentService.create(businessId, {
          clientId:       input.clientId,
          professionalId: input.professionalId,
          serviceId:      input.serviceId,
          scheduledAt:    input.scheduledAt,
          address:        input.address ?? null,
          notes:          input.notes   ?? null,
        });

      case 'get_client_appointments':
        return await appointmentService.getAll(businessId, {
          clientId: input.clientId,
          status:   'pendiente',
        });

      case 'cancel_appointment':
        await appointmentService.cancel(businessId, input.appointmentId);
        return { success: true };

      case 'get_professionals':
        return await professionalService.getAll(businessId);

      case 'notify_admin':
        return { ok: true, reason: input.reason };

      case 'delegate_to_admin':
        return { ok: true, delegated: true, reason: input.reason };

      default:
        return { error: true, message: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return { error: true, message: err.message };
  }
}

module.exports = { execute };
