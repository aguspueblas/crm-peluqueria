'use strict';

const express = require('express');
const router = express.Router();
const disponibilidadService = require('../services/disponibilidad.service');

router.get('/', async (req, res, next) => {
  try {
    const slots = await disponibilidadService.getSlots(req.query);
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
