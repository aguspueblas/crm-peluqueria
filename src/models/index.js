'use strict';

const Profesional = require('./Profesional');
const ProfesionalHorario = require('./ProfesionalHorario');
const Cliente = require('./Cliente');
const Servicio = require('./Servicio');
const Turno = require('./Turno');

// Profesional ↔ Horarios
Profesional.hasMany(ProfesionalHorario, { as: 'horarios', foreignKey: 'profesional_id' });
ProfesionalHorario.belongsTo(Profesional, { foreignKey: 'profesional_id' });

// Turno → entidades relacionadas
Turno.belongsTo(Cliente,     { foreignKey: 'cliente_id' });
Turno.belongsTo(Profesional, { foreignKey: 'profesional_id' });
Turno.belongsTo(Servicio,    { foreignKey: 'servicio_id' });
Cliente.hasMany(Turno,       { foreignKey: 'cliente_id' });
Profesional.hasMany(Turno,   { foreignKey: 'profesional_id' });

module.exports = { Profesional, ProfesionalHorario, Cliente, Servicio, Turno };
