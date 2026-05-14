'use strict';

const express = require('express');
const router = express.Router();
const clientesService = require('../services/clientes.service');

router.get('/', async (req, res, next) => {
  try {
    const clientes = await clientesService.getAll();
    res.json(clientes);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const cliente = await clientesService.getById(req.params.id);
    res.json(cliente);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const cliente = await clientesService.create(req.body);
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const cliente = await clientesService.update(req.params.id, req.body);
    res.json(cliente);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
