'use strict';

const express = require('express');
const router = express.Router();
const turnosService = require('../services/turnos.service');

router.get('/', async (req, res, next) => {
  try {
    const turnos = await turnosService.getAll();
    res.json(turnos);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const turno = await turnosService.create(req.body);
    res.status(201).json(turno);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const turno = await turnosService.update(req.params.id, req.body);
    res.json(turno);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await turnosService.cancel(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
