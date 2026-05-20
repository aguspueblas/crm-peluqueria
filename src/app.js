'use strict';

require('dotenv').config();

const express = require('express');
const auth    = require('./middlewares/auth');
const tenant  = require('./middlewares/tenant');
const errorHandler = require('./middlewares/errorHandler');

const negociosAdminRoutes      = require('./routes/admin/negocios');
const profesionalesAdminRoutes = require('./routes/admin/profesionales');
const serviciosAdminRoutes     = require('./routes/admin/servicios');
const turnosRoutes             = require('./routes/turnos');
const clientesRoutes           = require('./routes/clientes');
const disponibilidadRoutes     = require('./routes/disponibilidad');
const serviciosRoutes          = require('./routes/servicios');
const webhookRoutes            = require('./webhook');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin routes for managing negocios: require ADMIN_SECRET, no tenant context
app.use('/api/admin/negocios', auth, negociosAdminRoutes);

// Dev-only agent test route — no tenant middleware, simulates webhook flow
if (process.env.NODE_ENV === 'development') {
  const runner      = require('./agent/runner');
  const { Negocio } = require('./models');

  app.post('/dev/agent', async (req, res, next) => {
    try {
      const { negocio_id, from, senderName, message } = req.body;
      const negocio = await Negocio.findByPk(negocio_id);
      if (!negocio) return res.status(404).json({ error: 'Negocio not found' });
      const reply = await runner.run({ negocio, from, senderName, message });
      res.json({ reply });
    } catch (err) {
      next(err);
    }
  });
}

// Webhook — no tenant middleware, negocio resolved by whatsapp_number
app.use('/webhook/whatsapp', webhookRoutes);

// All other routes: require valid X-Api-Key (tenant resolution)
app.use(tenant);

app.use('/api/turnos',              turnosRoutes);
app.use('/api/clientes',            clientesRoutes);
app.use('/api/disponibilidad',      disponibilidadRoutes);
app.use('/api/servicios',           serviciosRoutes);
app.use('/api/admin/profesionales', profesionalesAdminRoutes);
app.use('/api/admin/servicios',     serviciosAdminRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
