'use strict';

const express = require('express');
const router  = express.Router();
const service = require('../services/catalog.service');

router.get('/', async (req, res, next) => {
  try {
    res.json(await service.getAll(req.negocio.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
