'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Professional = sequelize.define('Professional', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER, allowNull: false, field: 'negocio_id' },
  name:       { type: DataTypes.STRING(100), allowNull: false, field: 'nombre' },
  active:     { type: DataTypes.BOOLEAN, defaultValue: true, field: 'activo' },
}, {
  tableName: 'profesionales',
  timestamps: false,
});

module.exports = Professional;
