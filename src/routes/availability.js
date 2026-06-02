'use strict';

const express = require('express');
const router  = express.Router();
const service = require('../services/availability.service');

router.get('/next', async (req, res, next) => {
  try {
    const { serviceId, count, professionalId } = req.query;
    res.json(await service.getNextSlots(req.negocio.id, {
      serviceId:      serviceId      ? parseInt(serviceId)      : undefined,
      count:          count          ? parseInt(count)          : 3,
      professionalId: professionalId ? parseInt(professionalId) : null,
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await service.getSlots(req.negocio.id, req.query));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
