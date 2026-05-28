'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Conversacion = sequelize.define('Conversacion', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  negocio_id: { type: DataTypes.INTEGER, allowNull: false },
  telefono:   { type: DataTypes.STRING(20), allowNull: false },
  messages:   { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  estado:     { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'activa' },
}, {
  tableName: 'conversaciones',
  createdAt: false,
  updatedAt: 'updated_at',
});

module.exports = Conversacion;
