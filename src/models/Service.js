'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Service = sequelize.define('Service', {
  id:              { type: DataTypes.INTEGER,      primaryKey: true, autoIncrement: true },
  businessId:      { type: DataTypes.INTEGER,      allowNull: false, field: 'negocio_id' },
  name:            { type: DataTypes.STRING(100),  allowNull: false, field: 'nombre' },
  durationMinutes: { type: DataTypes.INTEGER,      allowNull: false, field: 'duracion_minutos' },
  price:           { type: DataTypes.DECIMAL(10,2),                  field: 'precio' },
}, {
  tableName: 'servicios',
  timestamps: false,
});

module.exports = Service;
