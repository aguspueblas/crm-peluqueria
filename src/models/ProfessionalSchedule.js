'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ProfessionalSchedule = sequelize.define('ProfessionalSchedule', {
  id:             { type: DataTypes.INTEGER,  primaryKey: true, autoIncrement: true },
  professionalId: { type: DataTypes.INTEGER,  allowNull: false, field: 'profesional_id' },
  weekday:        { type: DataTypes.SMALLINT, allowNull: false, field: 'dia_semana' },
  startTime:      { type: DataTypes.TIME,     allowNull: false, field: 'hora_inicio' },
  endTime:        { type: DataTypes.TIME,     allowNull: false, field: 'hora_fin' },
}, {
  tableName: 'profesional_horarios',
  timestamps: false,
});

module.exports = ProfessionalSchedule;
