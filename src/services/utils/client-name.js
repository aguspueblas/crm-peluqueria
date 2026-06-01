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

function sanitizeClientName(name) {
  if (!name || typeof name !== 'string') return null;

  const cleaned = name
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[^\p{L}\p{N} \-'.]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 2 || cleaned.length > 60) return null;

  return cleaned.replace(/\b\p{L}/gu, c => c.toUpperCase());
}

function validateClientName(name) {
  const sanitized = sanitizeClientName(name);
  if (!sanitized) {
    throw badRequest(`Invalid name: "${name}". Must be between 2 and 60 characters and cannot consist only of emojis or symbols.`);
  }
  return sanitized;
}

function validateSystemPrompt(template) {
  if (!template || typeof template !== 'string') return;

  const found = template.match(/\{[^}]+\}/g) ?? [];
  const invalid = found.filter(p => !VALID_PLACEHOLDERS.has(p));

  if (invalid.length > 0) {
    throw badRequest(
      `The system_prompt contains invalid placeholders: ${invalid.join(', ')}. ` +
      `Valid placeholders: ${[...VALID_PLACEHOLDERS].join(', ')}`
    );
  }
}

module.exports = { sanitizeClientName, validateClientName, validateSystemPrompt };
