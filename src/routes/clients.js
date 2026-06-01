'use strict';

const express = require('express');
const router  = express.Router();
const service = require('../services/client.service');

// /find-or-create must come before /:id so Express does not interpret it as an ID
router.post('/find-or-create', async (req, res, next) => {
  try {
    const result = await service.findOrCreate(req.negocio.id, req.body);
    res.status(result.isNew ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
});

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

module.exports = router;
