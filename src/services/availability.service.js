'use strict';

const sequelize = require('../config/sequelize');
const { Professional, ProfessionalSchedule, Service } = require('../models');
const { notFound, badRequest } = require('../utils/errors');

async function getSlots(businessId, { date, serviceId, professionalId }) {
  if (!date)      throw badRequest('date is required (YYYY-MM-DD)');
  if (!serviceId) throw badRequest('serviceId is required');

  const service = await Service.findOne({ where: { id: serviceId, businessId } });
  if (!service) throw notFound('Service not found');

  const { durationMinutes } = service;

  const dateObj = new Date(`${date}T00:00:00`);
  if (isNaN(dateObj)) throw badRequest('Invalid date format. Use YYYY-MM-DD');
  if (dateObj < new Date(new Date().setHours(0, 0, 0, 0)))
    throw badRequest('date cannot be in the past');

  const weekday = dateObj.getDay();

  const whereProf = { businessId, active: true };
  if (professionalId) whereProf.id = professionalId;

  const professionals = await Professional.findAll({
    where: whereProf,
    include: [{
      model: ProfessionalSchedule,
      as: 'schedules',
      where: { weekday },
      required: true,
    }],
    order: [['name', 'ASC']],
  });

  if (professionalId && professionals.length === 0) {
    const prof = await Professional.findByPk(professionalId);
    if (!prof) throw notFound('Professional not found');
    return { date, professional: { id: prof.id, name: prof.name }, slots: [] };
  }

  const bookedSlots = professionals.length > 0
    ? await sequelize.query(
        `SELECT
           t.profesional_id AS "professionalId",
           TO_CHAR(t.fecha_hora - INTERVAL '3 hours', 'HH24:MI') AS "timeLocal",
           s.duracion_minutos AS "durationMinutes"
         FROM turnos t
         JOIN servicios s ON s.id = t.servicio_id
         WHERE t.profesional_id IN (:ids)
           AND DATE(t.fecha_hora - INTERVAL '3 hours') = :date
           AND t.estado IN ('pendiente', 'confirmado')`,
        {
          replacements: { ids: professionals.map(p => p.id), date },
          type: sequelize.QueryTypes.SELECT,
        }
      )
    : [];

  const slotsByProfessional = professionals.map(prof => {
    const booked    = bookedSlots.filter(b => parseInt(b.professionalId) === prof.id);
    const freeSlots = [];

    for (const schedule of prof.schedules) {
      for (const slot of generateSlots(schedule.startTime, schedule.endTime, durationMinutes)) {
        if (!isBooked(slot, booked, durationMinutes)) freeSlots.push(slot);
      }
    }

    return { professional: { id: prof.id, name: prof.name }, slots: freeSlots };
  });

  const serviceInfo = { id: service.id, name: service.name, durationMinutes };

  if (professionalId) {
    const { professional, slots } = slotsByProfessional[0];
    return { date, service: serviceInfo, professional, slots };
  }

  const slotMap = {};
  for (const { professional, slots } of slotsByProfessional) {
    for (const time of slots) {
      if (!slotMap[time]) slotMap[time] = [];
      slotMap[time].push(professional);
    }
  }

  return {
    date,
    service: serviceInfo,
    slots: Object.keys(slotMap).sort().map(time => ({ time, professionals: slotMap[time] })),
  };
}

function generateSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  const [startH, startM] = startTime.toString().slice(0, 5).split(':').map(Number);
  const [endH,   endM]   = endTime.toString().slice(0, 5).split(':').map(Number);

  let minutes    = startH * 60 + startM;
  const endTotal = endH   * 60 + endM;

  while (minutes + durationMinutes <= endTotal) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    minutes += durationMinutes;
  }

  return slots;
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isBooked(slot, booked, durationMinutes) {
  const slotStart = timeToMinutes(slot);
  const slotEnd   = slotStart + durationMinutes;

  return booked.some(b => {
    const bookedStart = timeToMinutes(b.timeLocal);
    const bookedEnd   = bookedStart + parseInt(b.durationMinutes);
    return bookedStart < slotEnd && bookedEnd > slotStart;
  });
}

module.exports = { getSlots };
