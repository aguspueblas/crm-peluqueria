'use strict';

const serviciosService      = require('../services/servicios.service');
const disponibilidadService = require('../services/disponibilidad.service');
const clientesService       = require('../services/clientes.service');
const turnosService         = require('../services/turnos.service');
const profesionalesService  = require('../services/profesionales.service');
const { validarNombreCliente } = require('../services/utils/nombre');

async function execute(toolName, input, negocio_id) {
  try {
    switch (toolName) {
      case 'get_servicios':
        return await serviciosService.getAll(negocio_id);

      case 'get_disponibilidad':
        return await disponibilidadService.getSlots(negocio_id, {
          fecha:          input.fecha,
          servicio_id:    input.servicio_id,
          profesional_id: input.profesional_id,
        });

      case 'actualizar_cliente': {
        const nombreValido = validarNombreCliente(input.nombre);
        await clientesService.updateNombre(negocio_id, input.cliente_id, nombreValido);
        return { ok: true, nombre: nombreValido };
      }

      case 'crear_turno':
        return await turnosService.create(negocio_id, {
          cliente_id:     input.cliente_id,
          profesional_id: input.profesional_id,
          servicio_id:    input.servicio_id,
          fecha_hora:     input.fecha_hora,
          direccion:      input.direccion ?? null,
          observaciones:  input.observaciones ?? null,
        });

      case 'get_turnos_cliente':
        return await turnosService.getAll(negocio_id, {
          cliente_id: input.cliente_id,
          estado:     'pendiente',
        });

      case 'cancelar_turno':
        await turnosService.cancel(negocio_id, input.turno_id);
        return { success: true };

      case 'get_profesionales':
        return await profesionalesService.getAll(negocio_id);

      case 'notificar_admin':
        return { ok: true, motivo: input.motivo };

      case 'derivar_a_admin':
        return { ok: true, derivado: true, motivo: input.motivo };

      default:
        return { error: true, message: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return { error: true, message: err.message };
  }
}

module.exports = { execute };
