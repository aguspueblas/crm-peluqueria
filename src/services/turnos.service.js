'use strict';

const pool = require('../config/db');

async function getAll() {
  const result = await pool.query('SELECT * FROM turnos ORDER BY fecha_hora ASC');
  return result.rows;
}

async function create(data) {
  const { cliente_id, profesional_id, servicio_id, fecha_hora } = data;
  const result = await pool.query(
    'INSERT INTO turnos (cliente_id, profesional_id, servicio_id, fecha_hora, estado) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [cliente_id, profesional_id, servicio_id, fecha_hora, 'pendiente']
  );
  return result.rows[0];
}

async function update(id, data) {
  const { fecha_hora, estado } = data;
  const result = await pool.query(
    'UPDATE turnos SET fecha_hora = COALESCE($1, fecha_hora), estado = COALESCE($2, estado) WHERE id = $3 RETURNING *',
    [fecha_hora, estado, id]
  );
  if (result.rows.length === 0) {
    const err = new Error('Turno no encontrado');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

async function cancel(id) {
  const result = await pool.query(
    'UPDATE turnos SET estado = $1 WHERE id = $2 RETURNING *',
    ['cancelado', id]
  );
  if (result.rows.length === 0) {
    const err = new Error('Turno no encontrado');
    err.status = 404;
    throw err;
  }
}

module.exports = { getAll, create, update, cancel };
