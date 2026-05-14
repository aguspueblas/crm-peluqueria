'use strict';

const pool = require('../config/db');

async function getSlots({ fecha, profesional_id }) {
  if (!fecha) {
    const err = new Error('El parámetro "fecha" es requerido (YYYY-MM-DD)');
    err.status = 400;
    throw err;
  }

  const params = [fecha];
  let query = `
    SELECT
      p.id AS profesional_id,
      p.nombre AS profesional,
      s.nombre AS servicio,
      s.duracion_minutos,
      t.fecha_hora AS turno_ocupado
    FROM profesionales p
    CROSS JOIN servicios s
    LEFT JOIN turnos t
      ON t.profesional_id = p.id
      AND t.fecha_hora::date = $1
      AND t.estado != 'cancelado'
    WHERE p.activo = true
  `;

  if (profesional_id) {
    params.push(profesional_id);
    query += ` AND p.id = $${params.length}`;
  }

  query += ' ORDER BY p.nombre, t.fecha_hora';

  const result = await pool.query(query, params);
  return result.rows;
}

module.exports = { getSlots };
