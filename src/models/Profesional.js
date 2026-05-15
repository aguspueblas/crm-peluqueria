'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Profesional = sequelize.define('Profesional', {
  id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  activo: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'profesionales',
});

module.exports = Profesional;
