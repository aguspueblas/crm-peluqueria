'use strict';

const sequelize = require('../config/sequelize');
const { Profesional, ProfesionalHorario } = require('../models');

const DURACION_MINUTOS = 30;

async function getSlots(negocio_id, { fecha, profesional_id }) {
  if (!fecha) throw badRequest('El parámetro fecha es requerido (YYYY-MM-DD)');

  const fechaDate = new Date(`${fecha}T00:00:00`);
  if (isNaN(fechaDate)) throw badRequest('Formato de fecha inválido. Use YYYY-MM-DD');
  if (fechaDate < new Date(new Date().setHours(0, 0, 0, 0)))
    throw badRequest('La fecha no puede ser en el pasado');

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
           s.duracion_minutos
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
      for (const slot of generarSlots(horario.hora_inicio, horario.hora_fin)) {
        if (!estaOcupado(slot, turnosProf)) {
          slotsLibres.push(slot);
        }
      }
    }

    return { profesional: { id: prof.id, nombre: prof.nombre }, slots: slotsLibres };
  });

  if (profesional_id) {
    const { profesional, slots } = slotsPorProfesional[0];
    return { fecha, profesional, slots };
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
    slots: Object.keys(slotMap).sort().map(hora => ({ hora, profesionales: slotMap[hora] })),
  };
}

function generarSlots(hora_inicio, hora_fin) {
  const slots = [];
  const [hi, mi] = hora_inicio.toString().slice(0, 5).split(':').map(Number);
  const [hf, mf] = hora_fin.toString().slice(0, 5).split(':').map(Number);

  let minutos = hi * 60 + mi;
  const finMinutos = hf * 60 + mf;

  while (minutos + DURACION_MINUTOS <= finMinutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    minutos += DURACION_MINUTOS;
  }

  return slots;
}

function horaToMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function estaOcupado(hora, turnos) {
  const slotMin = horaToMinutos(hora);
  const slotEnd = slotMin + DURACION_MINUTOS;

  return turnos.some(turno => {
    const turnoStart = horaToMinutos(turno.hora_local);
    const duracion = turno.duracion_minutos ?? DURACION_MINUTOS;
    const turnoEnd = turnoStart + duracion;
    return turnoStart < slotEnd && turnoEnd > slotMin;
  });
}

function notFound(msg) { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }

module.exports = { getSlots };
