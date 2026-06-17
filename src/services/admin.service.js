'use strict';

const sequelize = require('../config/sequelize');
const { AdminUser, Business } = require('../models');
const { notFound, conflict } = require('../utils/errors');

async function findByPhone(phone) {
  const admin = await AdminUser.findOne({
    where:   { telefono: phone, activo: true },
    include: [{ model: Business, through: { attributes: [] } }],
  });
  return admin ?? null;
}

async function getAdmins(businessId) {
  const admins = await AdminUser.findAll({
    include: [{
      model:      Business,
      through:    { attributes: [] },
      where:      { id: businessId },
      attributes: [],
    }],
    where: { activo: true },
  });
  return admins.map(a => ({ id: a.id, telefono: a.telefono }));
}

async function getAdminPhones(businessId) {
  const admins = await getAdmins(businessId);
  return admins.map(a => a.telefono);
}

async function register(nombre, telefono, businessId) {
  const business = await Business.findByPk(businessId);
  if (!business) throw notFound('Business not found');

  // MVP: one admin per business
  const [existing] = await sequelize.query(
    'SELECT admin_user_id FROM admin_negocio WHERE negocio_id = :businessId LIMIT 1',
    { replacements: { businessId }, type: sequelize.QueryTypes.SELECT }
  );
  if (existing) throw conflict(`Business ${businessId} already has an admin assigned`);

  let admin = await AdminUser.findOne({ where: { telefono } });
  if (!admin) admin = await AdminUser.create({ nombre, telefono });

  await admin.addBusiness(business);
  return admin;
}

module.exports = { findByPhone, getAdmins, getAdminPhones, register };
