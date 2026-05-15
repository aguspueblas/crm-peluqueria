'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ProfesionalHorario = sequelize.define('ProfesionalHorario', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  profesional_id: { type: DataTypes.INTEGER, allowNull: false },
  dia_semana:     { type: DataTypes.SMALLINT, allowNull: false },
  hora_inicio:    { type: DataTypes.TIME, allowNull: false },
  hora_fin:       { type: DataTypes.TIME, allowNull: false },
}, {
  tableName: 'profesional_horarios',
});

module.exports = ProfesionalHorario;
