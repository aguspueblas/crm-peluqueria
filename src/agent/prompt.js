'use strict';

const { Servicio, Profesional } = require('../models');
const clientesService           = require('../services/clientes.service');
const { getArgentinaDateInfo }  = require('./dateUtils');

const DEFAULT_RULES = 'Ayudá al cliente a reservar y cancelar turnos de forma amigable.';

function resolvePlaceholders(template, vars) {
  return template.replace(/\{[^}]+\}/g, match => vars[match] ?? match);
}

async function buildSystemPrompt(negocio, senderName, fromPhone) {
  const cliente = await clientesService.identificar(negocio.id, {
    telefono: fromPhone,
    nombre:   senderName,
  });

  const [servicios, profesionales] = await Promise.all([
    Servicio.findAll({
      where:      { negocio_id: negocio.id },
      attributes: ['id', 'nombre', 'duracion_minutos', 'precio'],
      order:      [['duracion_minutos', 'ASC']],
    }),
    Profesional.findAll({
      where:      { negocio_id: negocio.id, activo: true },
      attributes: ['id', 'nombre'],
      order:      [['nombre', 'ASC']],
    }),
  ]);

  const serviciosList = servicios.length > 0
    ? servicios.map(s => {
        const precio = s.precio ? ` · $${s.precio}` : '';
        return `  - ${s.nombre} · ${s.duracion_minutos} min${precio} · id: ${s.id}`;
      }).join('\n')
    : '  (sin servicios cargados aún)';

  const profesionalesList = profesionales.length > 0
    ? profesionales.map(p => `  - ${p.nombre} (id: ${p.id})`).join('\n')
    : '  (sin profesionales activos)';

  const { readable: todayReadable, isoDate: todayISO } = getArgentinaDateInfo();

  const templateRaw    = negocio.system_prompt?.trim() ?? DEFAULT_RULES;
  const agenteNombre   = negocio.agente_nombre ?? 'el asistente';

  const vars = {
    '{agente_nombre}':        agenteNombre,
    '{negocio_nombre}':       negocio.nombre,
    '{negocio_rubro}':        negocio.rubro,
    '{fecha_actual}':         `${todayReadable} (${todayISO})`,
    '{cliente_id}':           String(cliente.id),
    '{cliente_nombre}':       cliente.nombre ?? 'null',
    '{cliente_telefono}':     fromPhone,
    '{servicios_lista}':      serviciosList,
    '{profesionales_lista}':  profesionalesList,
  };

  const businessRules    = resolvePlaceholders(templateRaw, vars);
  const usesPlaceholders = Object.keys(vars).some(p => templateRaw.includes(p));

  // Para negocios con system_prompt legacy (sin placeholders), inyectamos los datos dinámicos
  const datosSection = usesPlaceholders ? '' : `

DATOS DINÁMICOS:
- Negocio: ${negocio.nombre} (${negocio.rubro})
- Fecha actual (Argentina, UTC-3): ${todayReadable} (${todayISO})
- Cliente: ${senderName} / ${fromPhone}
- Servicios disponibles:
${serviciosList}`;

  return `
${businessRules}${datosSection}

FLUJO PARA AGENDAR UN TURNO:
1. Si {cliente_nombre} es null o no parece un nombre real, pedíselo UNA SOLA VEZ. Cuando el cliente lo dé, llamá a actualizar_cliente con el cliente_id y el nombre recibido.
2. Consultá disponibilidad con get_disponibilidad usando el servicio_id que corresponda.
3. Presentá las opciones y esperá que el cliente confirme fecha, hora y (si aplica) profesional.
4. Resumí el turno y preguntá "¿Confirmás?" explícitamente. Esperá respuesta.
5. Solo si el cliente confirma: PRIMERO llamá a crear_turno y esperá el resultado. NUNCA confirmes de palabra sin haber recibido un id de turno válido.
6. Si crear_turno devuelve conflicto, disculpate y ofrecé alternativas con get_disponibilidad.
7. Tras crear_turno exitoso, confirmá al cliente según las reglas del negocio.

FLUJO PARA CANCELAR UN TURNO:
1. Llamá a get_turnos_cliente para obtener los turnos activos.
2. Mostrá los turnos en lenguaje natural (sin IDs).
3. Esperá que el cliente indique cuál cancelar.
4. Llamá a cancelar_turno con el ID correspondiente.
5. Confirmá la cancelación.

FORMATO DE FECHAS:
- Con el cliente: lenguaje natural ("el lunes 25 de mayo a las 10:00").
- Con las APIs: formato ISO sin zona horaria ("2026-05-25T10:00:00").
- Nunca agendés en fechas pasadas.

REGLAS GENERALES:
- Saludá al cliente por su nombre solo en el primer mensaje.
- Respondé en español rioplatense, amigable y conciso. Mensajes cortos.
- Nunca inventes disponibilidad — siempre consultá las tools.
- No menciones IDs, nombres de funciones ni términos técnicos al cliente.
- NUNCA le pidas el teléfono al cliente — ya lo tenés.
`.trim();
}

module.exports = { buildSystemPrompt };
