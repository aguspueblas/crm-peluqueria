'use strict';

const { Negocio } = require('../models');

async function tenant(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Se requiere el header X-Api-Key' });

  const negocio = await Negocio.findOne({ where: { api_key: apiKey, activo: true } });
  if (!negocio) return res.status(401).json({ error: 'API key inválida o negocio inactivo' });

  req.negocio = negocio;
  next();
}

module.exports = tenant;
