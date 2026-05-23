'use strict';

const { badRequest } = require('../../utils/errors');

const VALID_PLACEHOLDERS = new Set([
  '{agente_nombre}',
  '{negocio_nombre}',
  '{negocio_rubro}',
  '{fecha_actual}',
  '{cliente_id}',
  '{cliente_nombre}',
  '{cliente_telefono}',
  '{servicios_lista}',
  '{profesionales_lista}',
]);

function sanitizarNombreCliente(nombre) {
  if (!nombre || typeof nombre !== 'string') return null;

  const limpio = nombre
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[^\p{L}\p{N} \-'.]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (limpio.length < 2 || limpio.length > 60) return null;

  return limpio.replace(/\b\p{L}/gu, c => c.toUpperCase());
}

function validarNombreCliente(nombre) {
  const sanitizado = sanitizarNombreCliente(nombre);
  if (!sanitizado) throw badRequest(`Nombre inválido: "${nombre}". Debe tener entre 2 y 60 caracteres y no contener solo emojis o símbolos.`);
  return sanitizado;
}

function validateSystemPrompt(template) {
  if (!template || typeof template !== 'string') return;

  const encontrados = template.match(/\{[^}]+\}/g) ?? [];
  const invalidos = encontrados.filter(p => !VALID_PLACEHOLDERS.has(p));

  if (invalidos.length > 0) {
    throw badRequest(
      `El system_prompt contiene placeholders inválidos: ${invalidos.join(', ')}. ` +
      `Válidos: ${[...VALID_PLACEHOLDERS].join(', ')}`
    );
  }
}

module.exports = { sanitizarNombreCliente, validarNombreCliente, validateSystemPrompt };
