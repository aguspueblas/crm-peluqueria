'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Client = sequelize.define('Client', {
  id:         { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER,     allowNull: false, field: 'negocio_id' },
  name:       { type: DataTypes.STRING(100), allowNull: false, field: 'nombre' },
  phone:      { type: DataTypes.STRING(20),  allowNull: false, field: 'telefono' },
  email:      { type: DataTypes.STRING(150),                   field: 'email' },
  createdAt:  { type: DataTypes.DATE,        defaultValue: DataTypes.NOW, field: 'created_at' },
}, {
  tableName: 'clientes',
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Client;
