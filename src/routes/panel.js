'use strict';

const { Router } = require('express');
const panelService = require('../services/panel.service');

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await panelService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
