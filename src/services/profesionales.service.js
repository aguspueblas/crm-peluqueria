'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { Profesional, ProfesionalHorario, Turno } = require('../models');

const INCLUDE_HORARIOS = {
  model: ProfesionalHorario,
  as: 'horarios',
  order: [['dia_semana', 'ASC'], ['hora_inicio', 'ASC']],
};

async function getAll(negocio_id) {
  return Profesional.findAll({ where: { negocio_id }, include: [INCLUDE_HORARIOS], order: [['nombre', 'ASC']] });
}

async function getById(negocio_id, id) {
  const profesional = await Profesional.findOne({ where: { id, negocio_id }, include: [INCLUDE_HORARIOS] });
  if (!profesional) throw notFound('Profesional no encontrado');
  return profesional;
}

async function create(negocio_id, { nombre, horarios }) {
  if (!nombre) throw badRequest('El campo nombre es requerido');
  if (!Array.isArray(horarios) || horarios.length === 0)
    throw badRequest('Debe incluir al menos un bloque de horario');

  horarios.forEach(validarBloque);

  return sequelize.transaction(async (t) => {
    const profesional = await Profesional.create({ negocio_id, nombre }, { transaction: t });

    for (const h of horarios) {
      await checkSolapamiento(profesional.id, h.dia_semana, h.hora_inicio, h.hora_fin, null, t);
      await ProfesionalHorario.create(
        { profesional_id: profesional.id, ...h },
        { transaction: t }
      );
    }

    return Profesional.findOne({ where: { id: profesional.id }, include: [INCLUDE_HORARIOS], transaction: t });
  });
}

async function update(negocio_id, id, { nombre, activo }) {
  const profesional = await getById(negocio_id, id);

  await profesional.update({ nombre, activo });

  let turnos_cancelados = 0;
  if (activo === false && profesional.previous('activo') === true) {
    const result = await Turno.update(
      { estado: 'cancelado' },
      {
        where: {
          profesional_id: id,
          fecha_hora: { [Op.gt]: new Date() },
          estado: { [Op.in]: ['pendiente', 'confirmado'] },
        },
      }
    );
    turnos_cancelados = result[0];
  }

  await profesional.reload({ include: [INCLUDE_HORARIOS] });
  return { ...profesional.toJSON(), turnos_cancelados };
}

async function addHorario(negocio_id, profesional_id, { dia_semana, hora_inicio, hora_fin }) {
  await getById(negocio_id, profesional_id);
  validarBloque({ dia_semana, hora_inicio, hora_fin });
  await checkSolapamiento(profesional_id, dia_semana, hora_inicio, hora_fin, null);
  return ProfesionalHorario.create({ profesional_id, dia_semana, hora_inicio, hora_fin });
}

async function updateHorario(negocio_id, profesional_id, horario_id, data) {
  await getById(negocio_id, profesional_id);
  const horario = await getHorario(horario_id, profesional_id);

  const nuevoDia    = data.dia_semana  ?? horario.dia_semana;
  const nuevoInicio = data.hora_inicio ?? horario.hora_inicio;
  const nuevoFin    = data.hora_fin    ?? horario.hora_fin;

  validarBloque({ dia_semana: nuevoDia, hora_inicio: nuevoInicio, hora_fin: nuevoFin });
  await checkSolapamiento(profesional_id, nuevoDia, nuevoInicio, nuevoFin, horario_id);

  return horario.update({ dia_semana: nuevoDia, hora_inicio: nuevoInicio, hora_fin: nuevoFin });
}

async function deleteHorario(negocio_id, profesional_id, horario_id) {
  await getById(negocio_id, profesional_id);
  const horario = await getHorario(horario_id, profesional_id);

  const conflictos = await Turno.count({
    where: {
      profesional_id,
      fecha_hora: { [Op.gt]: new Date() },
      estado: { [Op.in]: ['pendiente', 'confirmado'] },
      [Op.and]: sequelize.literal(
        `EXTRACT(DOW FROM fecha_hora) = ${horario.dia_semana}
         AND fecha_hora::time >= '${horario.hora_inicio}'
         AND fecha_hora::time < '${horario.hora_fin}'`
      ),
    },
  });

  if (conflictos > 0)
    throw conflict('Existen turnos futuros en ese bloque horario. Cancelalos antes de eliminar el horario.');

  await horario.destroy();
}

async function getHorario(horario_id, profesional_id) {
  const horario = await ProfesionalHorario.findOne({ where: { id: horario_id, profesional_id } });
  if (!horario) throw notFound('Bloque de horario no encontrado');
  return horario;
}

async function checkSolapamiento(profesional_id, dia_semana, hora_inicio, hora_fin, excluir_id, transaction) {
  const solapado = await ProfesionalHorario.findOne({
    where: {
      profesional_id,
      dia_semana,
      hora_inicio: { [Op.lt]: hora_fin },
      hora_fin:    { [Op.gt]: hora_inicio },
      ...(excluir_id && { id: { [Op.ne]: excluir_id } }),
    },
    transaction,
  });
  if (solapado) throw conflict('El bloque de horario se solapa con uno existente en ese día');
}

function validarBloque({ dia_semana, hora_inicio, hora_fin }) {
  if (dia_semana === undefined || !hora_inicio || !hora_fin)
    throw badRequest('Cada bloque requiere dia_semana, hora_inicio y hora_fin');
  if (dia_semana < 0 || dia_semana > 6)
    throw badRequest('dia_semana debe ser entre 0 (domingo) y 6 (sábado)');
  if (hora_inicio >= hora_fin)
    throw badRequest('hora_inicio debe ser anterior a hora_fin');
}

function notFound(msg) { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }
function conflict(msg) { const e = new Error(msg); e.status = 409; return e; }

module.exports = { getAll, getById, create, update, addHorario, updateHorario, deleteHorario };
