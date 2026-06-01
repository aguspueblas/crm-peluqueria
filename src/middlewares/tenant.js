'use strict';

const { Business } = require('../models');

async function tenant(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'X-Api-Key header is required' });

  try {
    const business = await Business.findOne({ where: { apiKey, active: true } });
    if (!business) return res.status(401).json({ error: 'Invalid API key or inactive business' });

    req.negocio = business;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = tenant;
