'use strict';

const sequelize = require('../config/sequelize');
const { Profesional, ProfesionalHorario, Servicio } = require('../models');

async function getSlots(negocio_id, { fecha, servicio_id, profesional_id }) {
  if (!fecha) throw badRequest('fecha is required (YYYY-MM-DD)');
  if (!servicio_id) throw badRequest('servicio_id is required');

  const servicio = await Servicio.findOne({ where: { id: servicio_id, negocio_id } });
  if (!servicio) throw notFound('Service not found');

  const duracion_minutos = servicio.duracion_minutos;

  const fechaDate = new Date(`${fecha}T00:00:00`);
  if (isNaN(fechaDate)) throw badRequest('Invalid date format. Use YYYY-MM-DD');
  if (fechaDate < new Date(new Date().setHours(0, 0, 0, 0)))
    throw badRequest('fecha cannot be in the past');

  const dia_semana = fechaDate.getDay();

  const whereProf = { negocio_id, activo: true };
  if (profesional_id) whereProf.id = profesional_id;

  const profesionales = await Profesional.findAll({
    where: whereProf,
    include: [{
      model: ProfesionalHorario,
      as: 'horarios',
      where: { dia_semana },
      required: true,
    }],
    order: [['nombre', 'ASC']],
  });

  if (profesional_id && profesionales.length === 0) {
    const prof = await Profesional.findByPk(profesional_id);
    if (!prof) throw notFound('Profesional no encontrado');
    return { fecha, profesional: { id: prof.id, nombre: prof.nombre }, slots: [] };
  }

  // Raw query with AT TIME ZONE to avoid JavaScript timezone mismatch:
  // turno.fecha_hora is stored as UTC; we convert to Buenos Aires local time in the DB
  // and return hora_local as 'HH24:MI' string for timezone-agnostic comparison.
  const turnosDelDia = profesionales.length > 0
    ? await sequelize.query(
        `SELECT
           t.profesional_id,
           TO_CHAR(t.fecha_hora AT TIME ZONE 'America/Buenos_Aires', 'HH24:MI') AS hora_local,
           s.duracion_minutos AS duracion_minutos
         FROM turnos t
         JOIN servicios s ON s.id = t.servicio_id
         WHERE t.profesional_id IN (:ids)
           AND DATE(t.fecha_hora AT TIME ZONE 'America/Buenos_Aires') = :fecha
           AND t.estado IN ('pendiente', 'confirmado')`,
        {
          replacements: { ids: profesionales.map(p => p.id), fecha },
          type: sequelize.QueryTypes.SELECT,
        }
      )
    : [];

  const slotsPorProfesional = profesionales.map(prof => {
    const turnosProf = turnosDelDia.filter(t => parseInt(t.profesional_id) === prof.id);
    const slotsLibres = [];

    for (const horario of prof.horarios) {
      for (const slot of generarSlots(horario.hora_inicio, horario.hora_fin, duracion_minutos)) {
        if (!estaOcupado(slot, turnosProf, duracion_minutos)) {
          slotsLibres.push(slot);
        }
      }
    }

    return { profesional: { id: prof.id, nombre: prof.nombre }, slots: slotsLibres };
  });

  const servicioInfo = { id: servicio.id, nombre: servicio.nombre, duracion_minutos };

  if (profesional_id) {
    const { profesional, slots } = slotsPorProfesional[0];
    return { fecha, servicio: servicioInfo, profesional, slots };
  }

  const slotMap = {};
  for (const { profesional, slots } of slotsPorProfesional) {
    for (const hora of slots) {
      if (!slotMap[hora]) slotMap[hora] = [];
      slotMap[hora].push(profesional);
    }
  }

  return {
    fecha,
    servicio: servicioInfo,
    slots: Object.keys(slotMap).sort().map(hora => ({ hora, profesionales: slotMap[hora] })),
  };
}

function generarSlots(hora_inicio, hora_fin, duracion_minutos) {
  const slots = [];
  const [hi, mi] = hora_inicio.toString().slice(0, 5).split(':').map(Number);
  const [hf, mf] = hora_fin.toString().slice(0, 5).split(':').map(Number);

  let minutos = hi * 60 + mi;
  const finMinutos = hf * 60 + mf;

  while (minutos + duracion_minutos <= finMinutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    minutos += duracion_minutos;
  }

  return slots;
}

function horaToMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function estaOcupado(hora, turnos, duracion_minutos) {
  const slotMin = horaToMinutos(hora);
  const slotEnd = slotMin + duracion_minutos;

  return turnos.some(turno => {
    const turnoStart = horaToMinutos(turno.hora_local);
    const turnoEnd = turnoStart + parseInt(turno.duracion_minutos);
    return turnoStart < slotEnd && turnoEnd > slotMin;
  });
}

const { notFound, badRequest } = require('../utils/errors');

module.exports = { getSlots };
