'use strict';

const INTERNAL_ERROR = 'Error interno del servidor';

function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  console.error(`[${status}] ${req.method} ${req.path} — ${err.message}`);

  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? INTERNAL_ERROR
    : err.message || INTERNAL_ERROR;

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
