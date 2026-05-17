'use strict';

function auth(req, res, next) {
  if (!process.env.ADMIN_SECRET)
    return res.status(500).json({ error: 'ADMIN_SECRET is not configured on the server' });

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  next();
}

module.exports = auth;
