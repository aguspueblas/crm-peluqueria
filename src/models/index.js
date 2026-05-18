'use strict';

const Negocio = require('./Negocio');
const Profesional = require('./Profesional');
const ProfesionalHorario = require('./ProfesionalHorario');
const Cliente = require('./Cliente');
const Servicio = require('./Servicio');
const Turno = require('./Turno');
const Conversacion = require('./Conversacion');

// Negocio → todo lo demás
Negocio.hasMany(Profesional,  { foreignKey: 'negocio_id' });
Negocio.hasMany(Cliente,      { foreignKey: 'negocio_id' });
Negocio.hasMany(Servicio,     { foreignKey: 'negocio_id' });
Negocio.hasMany(Turno,        { foreignKey: 'negocio_id' });
Profesional.belongsTo(Negocio, { foreignKey: 'negocio_id' });
Cliente.belongsTo(Negocio,     { foreignKey: 'negocio_id' });
Servicio.belongsTo(Negocio,    { foreignKey: 'negocio_id' });
Turno.belongsTo(Negocio,       { foreignKey: 'negocio_id' });

// Profesional ↔ Horarios
Profesional.hasMany(ProfesionalHorario, { as: 'horarios', foreignKey: 'profesional_id' });
ProfesionalHorario.belongsTo(Profesional, { foreignKey: 'profesional_id' });

// Turno → entidades relacionadas
Turno.belongsTo(Cliente,     { foreignKey: 'cliente_id' });
Turno.belongsTo(Profesional, { foreignKey: 'profesional_id' });
Turno.belongsTo(Servicio,    { foreignKey: 'servicio_id' });
Cliente.hasMany(Turno,       { foreignKey: 'cliente_id' });
Profesional.hasMany(Turno,   { foreignKey: 'profesional_id' });

Negocio.hasMany(Conversacion, { foreignKey: 'negocio_id' });
Conversacion.belongsTo(Negocio, { foreignKey: 'negocio_id' });

module.exports = { Negocio, Profesional, ProfesionalHorario, Cliente, Servicio, Turno, Conversacion };
