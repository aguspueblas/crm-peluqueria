'use strict';

const pool = require('../config/db');

async function getAll() {
  const result = await pool.query('SELECT * FROM clientes ORDER BY nombre ASC');
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    const err = new Error('Cliente no encontrado');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

async function create(data) {
  const { nombre, telefono, email } = data;
  const result = await pool.query(
    'INSERT INTO clientes (nombre, telefono, email) VALUES ($1, $2, $3) RETURNING *',
    [nombre, telefono, email]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { nombre, telefono, email } = data;
  const result = await pool.query(
    'UPDATE clientes SET nombre = COALESCE($1, nombre), telefono = COALESCE($2, telefono), email = COALESCE($3, email) WHERE id = $4 RETURNING *',
    [nombre, telefono, email, id]
  );
  if (result.rows.length === 0) {
    const err = new Error('Cliente no encontrado');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
}

module.exports = { getAll, getById, create, update };
