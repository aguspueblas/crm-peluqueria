'use strict';

const bcrypt   = require('bcryptjs');
const { Business } = require('../models');
const { unauthorized } = require('../utils/errors');

async function login(email, password) {
  if (!email || !password) throw unauthorized('Email y contraseña son requeridos');

  const business = await Business.findOne({ where: { panelEmail: email, active: true } });
  if (!business || !business.panelPassword) throw unauthorized('Credenciales inválidas');

  const valid = await bcrypt.compare(password, business.panelPassword);
  if (!valid) throw unauthorized('Credenciales inválidas');

  return {
    negocioId: business.id,
    nombre:    business.name,
    apiKey:    business.apiKey,
  };
}

async function setCredentials(businessName, email, password) {
  const business = await Business.findOne({ where: { name: businessName } });
  if (!business) throw new Error(`Business "${businessName}" not found`);

  const hash = await bcrypt.hash(password, 12);
  await business.update({ panelEmail: email, panelPassword: hash });
  return { ok: true, negocioId: business.id, email };
}

module.exports = { login, setCredentials };
