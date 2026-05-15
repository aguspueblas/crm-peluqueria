'use strict';

require('dotenv').config();

const express = require('express');
const turnosRoutes = require('./routes/turnos');
const clientesRoutes = require('./routes/clientes');
const disponibilidadRoutes = require('./routes/disponibilidad');
const profesionalesAdminRoutes = require('./routes/admin/profesionales');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/turnos', turnosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);
app.use('/api/admin/profesionales', profesionalesAdminRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
