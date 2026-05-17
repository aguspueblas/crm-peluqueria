'use strict';

const express = require('express');
const router = express.Router();
const service = require('../services/servicios.service');

router.get('/', async (req, res, next) => {
  try {
    res.json(await service.getAll(req.negocio.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
