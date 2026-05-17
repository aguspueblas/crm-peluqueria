'use strict';

require('dotenv').config();

const express = require('express');
const tenant = require('./middlewares/tenant');
const errorHandler = require('./middlewares/errorHandler');

const negociosAdminRoutes     = require('./routes/admin/negocios');
const profesionalesAdminRoutes = require('./routes/admin/profesionales');
const serviciosAdminRoutes    = require('./routes/admin/servicios');
const turnosRoutes        = require('./routes/turnos');
const clientesRoutes      = require('./routes/clientes');
const disponibilidadRoutes = require('./routes/disponibilidad');
const serviciosRoutes     = require('./routes/servicios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas admin de negocios: sin tenant middleware (crean y gestionan negocios)
app.use('/api/admin/negocios', negociosAdminRoutes);

// Todas las demás rutas requieren X-Api-Key válida
app.use(tenant);

app.use('/api/turnos',              turnosRoutes);
app.use('/api/clientes',            clientesRoutes);
app.use('/api/disponibilidad',      disponibilidadRoutes);
app.use('/api/servicios',           serviciosRoutes);
app.use('/api/admin/profesionales', profesionalesAdminRoutes);
app.use('/api/admin/servicios',     serviciosAdminRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
