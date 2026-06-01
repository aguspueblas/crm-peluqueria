'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const { Professional, ProfessionalSchedule, Appointment } = require('../models');
const { notFound, badRequest, conflict } = require('../utils/errors');

const INCLUDE_SCHEDULES = {
  model: ProfessionalSchedule,
  as: 'schedules',
  order: [['weekday', 'ASC'], ['startTime', 'ASC']],
};

async function getAll(businessId) {
  return Professional.findAll({
    where: { businessId },
    include: [INCLUDE_SCHEDULES],
    order: [['name', 'ASC']],
  });
}

async function getById(businessId, id) {
  const professional = await Professional.findOne({
    where: { id, businessId },
    include: [INCLUDE_SCHEDULES],
  });
  if (!professional) throw notFound('Professional not found');
  return professional;
}

async function create(businessId, { name, schedules }) {
  if (!name) throw badRequest('name is required');
  if (!Array.isArray(schedules) || schedules.length === 0)
    throw badRequest('At least one schedule block is required');

  schedules.forEach(validateBlock);

  return sequelize.transaction(async (t) => {
    const professional = await Professional.create({ businessId, name }, { transaction: t });

    for (const block of schedules) {
      await checkOverlap(professional.id, block.weekday, block.startTime, block.endTime, null, t);
      await ProfessionalSchedule.create(
        { professionalId: professional.id, weekday: block.weekday, startTime: block.startTime, endTime: block.endTime },
        { transaction: t }
      );
    }

    return Professional.findOne({ where: { id: professional.id }, include: [INCLUDE_SCHEDULES], transaction: t });
  });
}

async function update(businessId, id, { name, active }) {
  const professional = await getById(businessId, id);

  const wasActive = professional.active;
  await professional.update({ name, active });

  let cancelledAppointments = 0;
  if (active === false && wasActive === true) {
    const [count] = await Appointment.update(
      { status: 'cancelado' },
      {
        where: {
          professionalId: id,
          scheduledAt: { [Op.gt]: new Date() },
          status: { [Op.in]: ['pendiente', 'confirmado'] },
        },
      }
    );
    cancelledAppointments = count;
  }

  await professional.reload({ include: [INCLUDE_SCHEDULES] });
  return { ...professional.toJSON(), cancelledAppointments };
}

async function addSchedule(businessId, professionalId, { weekday, startTime, endTime }) {
  await getById(businessId, professionalId);
  validateBlock({ weekday, startTime, endTime });
  await checkOverlap(professionalId, weekday, startTime, endTime, null);
  return ProfessionalSchedule.create({ professionalId, weekday, startTime, endTime });
}

async function updateSchedule(businessId, professionalId, scheduleId, data) {
  await getById(businessId, professionalId);
  const schedule = await getSchedule(scheduleId, professionalId);

  const newWeekday    = data.weekday    ?? schedule.weekday;
  const newStartTime  = data.startTime  ?? schedule.startTime;
  const newEndTime    = data.endTime    ?? schedule.endTime;

  validateBlock({ weekday: newWeekday, startTime: newStartTime, endTime: newEndTime });
  await checkOverlap(professionalId, newWeekday, newStartTime, newEndTime, scheduleId);

  return schedule.update({ weekday: newWeekday, startTime: newStartTime, endTime: newEndTime });
}

async function deleteSchedule(businessId, professionalId, scheduleId) {
  await getById(businessId, professionalId);
  const schedule = await getSchedule(scheduleId, professionalId);

  const rows = await sequelize.query(
    `SELECT COUNT(*) AS count FROM turnos
     WHERE profesional_id = :professionalId
       AND fecha_hora > NOW()
       AND estado IN ('pendiente', 'confirmado')
       AND EXTRACT(DOW FROM fecha_hora - INTERVAL '3 hours') = :weekday
       AND (fecha_hora - INTERVAL '3 hours')::time >= :startTime
       AND (fecha_hora - INTERVAL '3 hours')::time <  :endTime`,
    {
      replacements: {
        professionalId,
        weekday:   schedule.weekday,
        startTime: schedule.startTime.toString().slice(0, 8),
        endTime:   schedule.endTime.toString().slice(0, 8),
      },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  if (parseInt(rows[0].count) > 0)
    throw conflict('There are future appointments in this schedule block. Cancel them before deleting.');

  await schedule.destroy();
}

async function getSchedule(scheduleId, professionalId) {
  const schedule = await ProfessionalSchedule.findOne({ where: { id: scheduleId, professionalId } });
  if (!schedule) throw notFound('Schedule block not found');
  return schedule;
}

async function checkOverlap(professionalId, weekday, startTime, endTime, excludeId, transaction) {
  const overlapping = await ProfessionalSchedule.findOne({
    where: {
      professionalId,
      weekday,
      startTime: { [Op.lt]: endTime },
      endTime:   { [Op.gt]: startTime },
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
    transaction,
  });
  if (overlapping) throw conflict('This schedule block overlaps with an existing one on the same day');
}

function validateBlock({ weekday, startTime, endTime }) {
  if (weekday === undefined || !startTime || !endTime)
    throw badRequest('Each schedule block requires weekday, startTime and endTime');
  if (weekday < 0 || weekday > 6)
    throw badRequest('weekday must be between 0 (Sunday) and 6 (Saturday)');
  if (startTime >= endTime)
    throw badRequest('startTime must be earlier than endTime');
}

module.exports = { getAll, getById, create, update, addSchedule, updateSchedule, deleteSchedule };
