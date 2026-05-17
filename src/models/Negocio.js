'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Negocio = sequelize.define('Negocio', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre:    { type: DataTypes.STRING(100), allowNull: false },
  rubro:     { type: DataTypes.STRING(100), allowNull: false },
  api_key:   { type: DataTypes.STRING(64), allowNull: false, unique: true },
  activo:    { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'negocios',
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Negocio;
