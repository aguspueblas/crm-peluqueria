'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Servicio = sequelize.define('Servicio', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre:             { type: DataTypes.STRING(100), allowNull: false },
  duracion_minutos:   { type: DataTypes.INTEGER, allowNull: false },
  precio:             { type: DataTypes.DECIMAL(10, 2) },
}, {
  tableName: 'servicios',
});

module.exports = Servicio;
