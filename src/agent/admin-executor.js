'use strict';

const appointmentService  = require('../services/appointment.service');
const availabilityService = require('../services/availability.service');
const catalogService      = require('../services/catalog.service');
const clientService       = require('../services/client.service');

function todayAR() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
}

async function execute(toolName, input, businessId) {
  try {
    switch (toolName) {

      case 'get_appointments':
        return await appointmentService.getAll(businessId, {
          date:           input.date,
          professionalId: input.professionalId,
          status:         input.status,
        });

      case 'get_appointment_detail':
        return await appointmentService.getById(businessId, input.appointmentId);

      case 'create_appointment': {
        const client = await clientService.findOrCreate(businessId, {
          phone: input.clientPhone,
          name:  input.clientName ?? input.clientPhone,
        });
        return await appointmentService.create(businessId, {
          clientId:       client.id,
          professionalId: input.professionalId,
          serviceId:      input.serviceId,
          scheduledAt:    input.scheduledAt,
          address:        input.address ?? null,
          notes:          input.notes   ?? null,
        });
      }

      case 'update_appointment':
        return await appointmentService.update(businessId, input.appointmentId, {
          scheduledAt: input.scheduledAt,
          notes:       input.notes,
        });

      case 'cancel_appointment':
        await appointmentService.cancel(businessId, input.appointmentId);
        return { success: true };

      case 'confirm_appointment':
        return await appointmentService.update(businessId, input.appointmentId, { status: 'confirmado' });

      case 'get_availability':
        return await availabilityService.getSlots(businessId, {
          date:           input.date ?? todayAR(),
          serviceId:      input.serviceId,
          professionalId: input.professionalId,
        });

      case 'get_services':
        return await catalogService.getAll(businessId);

      default:
        return { error: true, message: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return { error: true, message: err.message };
  }
}

module.exports = { execute };
