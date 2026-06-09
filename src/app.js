'use strict';

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const auth         = require('./middlewares/auth');
const tenant       = require('./middlewares/tenant');
const errorHandler = require('./middlewares/errorHandler');
const store        = require('./conversation/store');

const businessesAdminRoutes    = require('./routes/admin/businesses');
const professionalsAdminRoutes = require('./routes/admin/professionals');
const servicesAdminRoutes      = require('./routes/admin/services');
const panelRoutes              = require('./routes/panel');
const appointmentsRoutes       = require('./routes/appointments');
const clientsRoutes            = require('./routes/clients');
const availabilityRoutes       = require('./routes/availability');
const servicesRoutes           = require('./routes/services');
const webhookRoutes            = require('./webhook');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.PANEL_URL ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Api-Key', 'X-Admin-Secret'],
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin routes — require ADMIN_SECRET, no tenant context
app.use('/api/admin/businesses', auth, businessesAdminRoutes);

// Dev-only agent test route — no tenant middleware, simulates webhook flow
if (process.env.NODE_ENV === 'development') {
  const runner   = require('./agent/runner');
  const { Business } = require('./models');

  app.post('/dev/agent', async (req, res, next) => {
    try {
      const { businessId, from, senderName, message } = req.body;
      const business = await Business.findByPk(businessId);
      if (!business) return res.status(404).json({ error: 'Business not found' });
      const reply = await runner.run({ business, from, senderName, message });
      res.json({ reply });
    } catch (err) {
      next(err);
    }
  });
}

// Panel routes — no auth middleware (login endpoint)
app.use('/api/panel', panelRoutes);

// Webhook — no tenant middleware, business resolved by whatsapp_number
app.use('/webhook/whatsapp', webhookRoutes);

// All other routes: require valid X-Api-Key (tenant resolution)
app.use(tenant);

app.use('/api/appointments',          appointmentsRoutes);
app.use('/api/clients',               clientsRoutes);
app.use('/api/availability',          availabilityRoutes);
app.use('/api/services',              servicesRoutes);
app.use('/api/admin/professionals',   professionalsAdminRoutes);
app.use('/api/admin/services',        servicesAdminRoutes);

app.use(errorHandler);

// Start conversation cleanup scheduler after all middleware is set up
store.startCleanupScheduler();

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});

module.exports = app;
