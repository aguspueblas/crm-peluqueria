'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Cliente = sequelize.define('Cliente', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  negocio_id: { type: DataTypes.INTEGER, allowNull: false },
  nombre:     { type: DataTypes.STRING(100), allowNull: false },
  telefono:   { type: DataTypes.STRING(20), allowNull: false },
  email:      { type: DataTypes.STRING(150) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'clientes',
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Cliente;
