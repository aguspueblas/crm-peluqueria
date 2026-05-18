'use strict';

const { Servicio } = require('../models');

async function buildSystemPrompt(negocio, senderName) {
  const servicios = await Servicio.findAll({
    where: { negocio_id: negocio.id },
    order: [['nombre', 'ASC']],
  });

  const serviciosList = servicios.length > 0
    ? servicios.map(s => {
        const precio = s.precio ? ` — $${s.precio}` : '';
        return `  - ${s.nombre} (${s.duracion_minutos} min${precio})`;
      }).join('\n')
    : '  (sin servicios cargados aún)';

  return `Sos un asistente de agendamiento para ${negocio.nombre}, un negocio de ${negocio.rubro}.
Tu trabajo es ayudar a los clientes a reservar, consultar y cancelar turnos por WhatsApp.
El cliente con quien estás hablando se llama ${senderName}.

SERVICIOS DISPONIBLES:
${serviciosList}

REGLAS:
- Saludá al cliente por su nombre solo en el primer mensaje de la conversación.
- Antes de reservar, confirmá siempre: servicio, profesional, fecha y hora.
- Si el cliente no especifica profesional, asigná el primero disponible sin preguntar.
- Respondé en español, de forma amigable y concisa. Mensajes cortos, no párrafos largos.
- Nunca inventes disponibilidad — siempre consultá con las tools.
- Si ocurre un error al reservar, explicalo en términos simples y ofrecé alternativas.
- No menciones IDs ni términos técnicos al cliente.`;
}

module.exports = { buildSystemPrompt };
