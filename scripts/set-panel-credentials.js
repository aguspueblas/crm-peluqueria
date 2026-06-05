'use strict';

/**
 * Carga credenciales del panel web para un negocio.
 *
 * Uso:
 *   node scripts/set-panel-credentials.js --negocio "Expreso Polar" --email "jonatan@expresopolar.com" --password "secreto"
 *   DATABASE_URL="..." node scripts/set-panel-credentials.js ...
 */

require('dotenv').config();

const sequelize    = require('../src/config/sequelize');
const panelService = require('../src/services/panel.service');

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : null;
}

const negocio  = getArg('negocio');
const email    = getArg('email');
const password = getArg('password');

if (!negocio || !email || !password) {
  console.error('Uso: node scripts/set-panel-credentials.js --negocio "Nombre" --email "email" --password "pass"');
  process.exit(1);
}

(async () => {
  await sequelize.authenticate();
  const result = await panelService.setCredentials(negocio, email, password);
  console.log(`[ok] Credenciales cargadas — negocioId=${result.negocioId} email=${result.email}`);
  await sequelize.close();
})().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
