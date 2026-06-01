'use strict';

const express = require('express');
const router  = express.Router();
const service = require('../../services/professional.service');

router.get('/', async (req, res, next) => {
  try {
    res.json(await service.getAll(req.negocio.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await service.getById(req.negocio.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

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

router.post('/:id/schedules', async (req, res, next) => {
  try {
    res.status(201).json(await service.addSchedule(req.negocio.id, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id/schedules/:scheduleId', async (req, res, next) => {
  try {
    res.json(await service.updateSchedule(req.negocio.id, req.params.id, req.params.scheduleId, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/schedules/:scheduleId', async (req, res, next) => {
  try {
    await service.deleteSchedule(req.negocio.id, req.params.id, req.params.scheduleId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
