'use strict';

const { Op } = require('sequelize');
const { Service, Appointment } = require('../models');
const { notFound, badRequest, conflict } = require('../utils/errors');

async function getAll(businessId) {
  return Service.findAll({
    where:      { businessId },
    attributes: ['id', 'name', 'durationMinutes', 'price'],
    order:      [['name', 'ASC']],
  });
}

async function create(businessId, { name, durationMinutes, price }) {
  if (!name || !durationMinutes) throw badRequest('name and durationMinutes are required');
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0)
    throw badRequest('durationMinutes must be a positive integer');
  return Service.create({ businessId, name, durationMinutes, price: price ?? null });
}

async function update(businessId, id, { name, durationMinutes, price }) {
  const service = await findOwned(businessId, id);
  if (durationMinutes !== undefined) {
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0)
      throw badRequest('durationMinutes must be a positive integer');
  }
  await service.update({ name, durationMinutes, price });
  return service;
}

async function remove(businessId, id) {
  const service = await findOwned(businessId, id);
  const active = await Appointment.count({
    where: { serviceId: id, status: { [Op.in]: ['pendiente', 'confirmado'] } },
  });
  if (active > 0) throw conflict('There are active appointments linked to this service');
  await service.destroy();
}

async function findOwned(businessId, id) {
  const service = await Service.findOne({ where: { id, businessId } });
  if (!service) throw notFound('Service not found');
  return service;
}

module.exports = { getAll, create, update, remove };
