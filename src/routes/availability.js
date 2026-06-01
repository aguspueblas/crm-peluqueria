'use strict';

const express = require('express');
const router  = express.Router();
const service = require('../services/availability.service');

router.get('/', async (req, res, next) => {
  try {
    res.json(await service.getSlots(req.negocio.id, req.query));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
