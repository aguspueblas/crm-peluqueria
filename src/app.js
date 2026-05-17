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

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin routes for managing negocios: require ADMIN_SECRET, no tenant context
app.use('/api/admin/negocios', auth, negociosAdminRoutes);

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
