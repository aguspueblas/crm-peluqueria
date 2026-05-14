'use strict';

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor';

  console.error(`[${status}] ${req.method} ${req.path} — ${message}`);

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
