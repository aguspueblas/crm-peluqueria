'use strict';

const express = require('express');
const router = express.Router();
const service = require('../services/clientes.service');

// /identificar debe ir antes de /:id para que Express no lo interprete como un ID
router.post('/identificar', async (req, res, next) => {
  try {
    const resultado = await service.identificar(req.body);
    res.status(resultado.es_nuevo ? 201 : 200).json(resultado);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    res.json(await service.getAll());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await service.getById(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await service.create(req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    res.json(await service.update(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
