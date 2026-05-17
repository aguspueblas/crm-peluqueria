'use strict';

const express = require('express');
const router = express.Router();
const service = require('../../services/servicios.service');

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await service.create(req.negocio.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    res.json(await service.update(req.negocio.id, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await service.remove(req.negocio.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
