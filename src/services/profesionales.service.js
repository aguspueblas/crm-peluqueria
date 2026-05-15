'use strict';

const pool = require('../config/db');

const HORARIOS_SELECT = `
  SELECT p.id, p.nombre, p.activo,
    COALESCE(
      json_agg(
        json_build_object(
          'id', h.id,
          'dia_semana', h.dia_semana,
          'hora_inicio', h.hora_inicio,
          'hora_fin', h.hora_fin
        ) ORDER BY h.dia_semana, h.hora_inicio
      ) FILTER (WHERE h.id IS NOT NULL),
      '[]'
    ) AS horarios
  FROM profesionales p
  LEFT JOIN profesional_horarios h ON h.profesional_id = p.id
`;

async function getAll() {
  const result = await pool.query(`${HORARIOS_SELECT} GROUP BY p.id ORDER BY p.nombre`);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query(`${HORARIOS_SELECT} WHERE p.id = $1 GROUP BY p.id`, [id]);
  if (result.rows.length === 0) throw notFound('Profesional no encontrado');
  return result.rows[0];
}

async function create({ nombre, horarios }) {
  if (!nombre) throw badRequest('El campo nombre es requerido');
  if (!Array.isArray(horarios) || horarios.length === 0)
    throw badRequest('Debe incluir al menos un bloque de horario');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'INSERT INTO profesionales (nombre) VALUES ($1) RETURNING id',
      [nombre]
    );
    const profesional_id = rows[0].id;

    for (const h of horarios) {
      validarBloque(h);
      await checkSolapamiento(client, profesional_id, h.dia_semana, h.hora_inicio, h.hora_fin, null);
      await client.query(
        'INSERT INTO profesional_horarios (profesional_id, dia_semana, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4)',
        [profesional_id, h.dia_semana, h.hora_inicio, h.hora_fin]
      );
    }

    await client.query('COMMIT');
    return getById(profesional_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function update(id, { nombre, activo }) {
  const prof = await getById(id);

  const nuevoNombre = nombre ?? prof.nombre;
  const nuevoActivo = activo ?? prof.activo;

  await pool.query(
    'UPDATE profesionales SET nombre = $1, activo = $2 WHERE id = $3',
    [nuevoNombre, nuevoActivo, id]
  );

  let turnos_cancelados = 0;
  if (activo === false && prof.activo === true) {
    const result = await pool.query(
      `UPDATE turnos SET estado = 'cancelado'
       WHERE profesional_id = $1
         AND fecha_hora > NOW()
         AND estado IN ('pendiente', 'confirmado')`,
      [id]
    );
    turnos_cancelados = result.rowCount;
  }

  const actualizado = await getById(id);
  return { ...actualizado, turnos_cancelados };
}

async function addHorario(profesional_id, { dia_semana, hora_inicio, hora_fin }) {
  await getById(profesional_id);
  validarBloque({ dia_semana, hora_inicio, hora_fin });
  await checkSolapamiento(pool, profesional_id, dia_semana, hora_inicio, hora_fin, null);

  const result = await pool.query(
    'INSERT INTO profesional_horarios (profesional_id, dia_semana, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4) RETURNING *',
    [profesional_id, dia_semana, hora_inicio, hora_fin]
  );
  return result.rows[0];
}

async function updateHorario(profesional_id, horario_id, { dia_semana, hora_inicio, hora_fin }) {
  await getById(profesional_id);
  const horario = await getHorario(horario_id, profesional_id);

  const nuevoDia = dia_semana ?? horario.dia_semana;
  const nuevoInicio = hora_inicio ?? horario.hora_inicio;
  const nuevoFin = hora_fin ?? horario.hora_fin;

  validarBloque({ dia_semana: nuevoDia, hora_inicio: nuevoInicio, hora_fin: nuevoFin });
  await checkSolapamiento(pool, profesional_id, nuevoDia, nuevoInicio, nuevoFin, horario_id);

  const result = await pool.query(
    'UPDATE profesional_horarios SET dia_semana = $1, hora_inicio = $2, hora_fin = $3 WHERE id = $4 RETURNING *',
    [nuevoDia, nuevoInicio, nuevoFin, horario_id]
  );
  return result.rows[0];
}

async function deleteHorario(profesional_id, horario_id) {
  await getById(profesional_id);
  const horario = await getHorario(horario_id, profesional_id);

  const conflicto = await pool.query(
    `SELECT COUNT(*) FROM turnos
     WHERE profesional_id = $1
       AND fecha_hora > NOW()
       AND estado IN ('pendiente', 'confirmado')
       AND EXTRACT(DOW FROM fecha_hora) = $2
       AND fecha_hora::time >= $3
       AND fecha_hora::time < $4`,
    [profesional_id, horario.dia_semana, horario.hora_inicio, horario.hora_fin]
  );

  if (parseInt(conflicto.rows[0].count) > 0) {
    const err = new Error('Existen turnos futuros en ese bloque horario. Cancelalos antes de eliminar el horario.');
    err.status = 409;
    throw err;
  }

  await pool.query('DELETE FROM profesional_horarios WHERE id = $1', [horario_id]);
}

async function getHorario(horario_id, profesional_id) {
  const result = await pool.query(
    'SELECT * FROM profesional_horarios WHERE id = $1 AND profesional_id = $2',
    [horario_id, profesional_id]
  );
  if (result.rows.length === 0) throw notFound('Bloque de horario no encontrado');
  return result.rows[0];
}

async function checkSolapamiento(db, profesional_id, dia_semana, hora_inicio, hora_fin, excluir_id) {
  const result = await db.query(
    `SELECT id FROM profesional_horarios
     WHERE profesional_id = $1
       AND dia_semana = $2
       AND hora_inicio < $4
       AND hora_fin > $3
       AND ($5::integer IS NULL OR id != $5)`,
    [profesional_id, dia_semana, hora_inicio, hora_fin, excluir_id]
  );
  if (result.rows.length > 0) {
    const err = new Error('El bloque de horario se solapa con uno existente en ese día');
    err.status = 409;
    throw err;
  }
}

function validarBloque({ dia_semana, hora_inicio, hora_fin }) {
  if (dia_semana === undefined || hora_inicio === undefined || hora_fin === undefined)
    throw badRequest('Cada bloque requiere dia_semana, hora_inicio y hora_fin');
  if (dia_semana < 0 || dia_semana > 6)
    throw badRequest('dia_semana debe ser un número entre 0 (domingo) y 6 (sábado)');
  if (hora_inicio >= hora_fin)
    throw badRequest('hora_inicio debe ser anterior a hora_fin');
}

function notFound(msg) {
  const err = new Error(msg);
  err.status = 404;
  return err;
}

function badRequest(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

module.exports = { getAll, getById, create, update, addHorario, updateHorario, deleteHorario };
