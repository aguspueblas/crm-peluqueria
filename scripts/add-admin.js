'use strict';

/**
 * Register an admin user and link them to a business.
 *
 * Usage:
 *   node scripts/add-admin.js --phone +5491112345678 --name "Jonatan" --businessId 2
 */

require('dotenv').config();

const adminService = require('../src/services/admin.service');

async function main() {
  const args = process.argv.slice(2);
  const get  = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };

  const phone      = get('--phone');
  const nombre     = get('--name') ?? 'Admin';
  const businessId = parseInt(get('--businessId') ?? '0', 10);

  if (!phone || !businessId) {
    console.error('Usage: node scripts/add-admin.js --phone +54911... --name "Nombre" --businessId <id>');
    process.exit(1);
  }

  const admin = await adminService.register(nombre, phone, businessId);
  console.log(`Admin registrado: id=${admin.id} nombre=${admin.nombre} telefono=${admin.telefono} -> negocio=${businessId}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
