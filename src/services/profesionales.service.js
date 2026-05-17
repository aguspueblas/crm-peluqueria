'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { Profesional, ProfesionalHorario, Turno } = require('../models');
const { notFound, badRequest, conflict } = require('../utils/errors');

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
  if (!profesional) throw notFound('Professional not found');
  return profesional;
}

async function create(negocio_id, { nombre, horarios }) {
  if (!nombre) throw badRequest('nombre is required');
  if (!Array.isArray(horarios) || horarios.length === 0)
    throw badRequest('At least one schedule block is required');

  horarios.forEach(validateBlock);

  return sequelize.transaction(async (t) => {
    const profesional = await Profesional.create({ negocio_id, nombre }, { transaction: t });

    for (const h of horarios) {
      await checkOverlap(profesional.id, h.dia_semana, h.hora_inicio, h.hora_fin, null, t);
      await ProfesionalHorario.create({ profesional_id: profesional.id, ...h }, { transaction: t });
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
  validateBlock({ dia_semana, hora_inicio, hora_fin });
  await checkOverlap(profesional_id, dia_semana, hora_inicio, hora_fin, null);
  return ProfesionalHorario.create({ profesional_id, dia_semana, hora_inicio, hora_fin });
}

async function updateHorario(negocio_id, profesional_id, horario_id, data) {
  await getById(negocio_id, profesional_id);
  const horario = await getHorario(horario_id, profesional_id);

  const newDay   = data.dia_semana  ?? horario.dia_semana;
  const newStart = data.hora_inicio ?? horario.hora_inicio;
  const newEnd   = data.hora_fin    ?? horario.hora_fin;

  validateBlock({ dia_semana: newDay, hora_inicio: newStart, hora_fin: newEnd });
  await checkOverlap(profesional_id, newDay, newStart, newEnd, horario_id);

  return horario.update({ dia_semana: newDay, hora_inicio: newStart, hora_fin: newEnd });
}

async function deleteHorario(negocio_id, profesional_id, horario_id) {
  await getById(negocio_id, profesional_id);
  const horario = await getHorario(horario_id, profesional_id);

  // Raw query with named replacements — avoids sequelize.literal() string interpolation
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS count FROM turnos
     WHERE profesional_id = :profesional_id
       AND fecha_hora > NOW()
       AND estado IN ('pendiente', 'confirmado')
       AND EXTRACT(DOW FROM fecha_hora AT TIME ZONE 'America/Buenos_Aires') = :dia_semana
       AND (fecha_hora AT TIME ZONE 'America/Buenos_Aires')::time >= :hora_inicio
       AND (fecha_hora AT TIME ZONE 'America/Buenos_Aires')::time <  :hora_fin`,
    {
      replacements: {
        profesional_id,
        dia_semana:   horario.dia_semana,
        hora_inicio:  horario.hora_inicio.toString().slice(0, 8),
        hora_fin:     horario.hora_fin.toString().slice(0, 8),
      },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  if (parseInt(rows[0].count) > 0)
    throw conflict('There are future appointments in this schedule block. Cancel them before deleting.');

  await horario.destroy();
}

async function getHorario(horario_id, profesional_id) {
  const horario = await ProfesionalHorario.findOne({ where: { id: horario_id, profesional_id } });
  if (!horario) throw notFound('Schedule block not found');
  return horario;
}

async function checkOverlap(profesional_id, dia_semana, hora_inicio, hora_fin, excluir_id, transaction) {
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
  if (solapado) throw conflict('This schedule block overlaps with an existing one on the same day');
}

function validateBlock({ dia_semana, hora_inicio, hora_fin }) {
  if (dia_semana === undefined || !hora_inicio || !hora_fin)
    throw badRequest('Each block requires dia_semana, hora_inicio and hora_fin');
  if (dia_semana < 0 || dia_semana > 6)
    throw badRequest('dia_semana must be between 0 (Sunday) and 6 (Saturday)');
  if (hora_inicio >= hora_fin)
    throw badRequest('hora_inicio must be earlier than hora_fin');
}

module.exports = { getAll, getById, create, update, addHorario, updateHorario, deleteHorario };
