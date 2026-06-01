'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Appointment = sequelize.define('Appointment', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  businessId:     { type: DataTypes.INTEGER, allowNull: false, field: 'negocio_id' },
  clientId:       { type: DataTypes.INTEGER, allowNull: false, field: 'cliente_id' },
  professionalId: { type: DataTypes.INTEGER, allowNull: false, field: 'profesional_id' },
  serviceId:      { type: DataTypes.INTEGER, allowNull: false, field: 'servicio_id' },
  scheduledAt:    { type: DataTypes.DATE,    allowNull: false, field: 'fecha_hora' },
  status:         { type: DataTypes.ENUM('pendiente', 'confirmado', 'cancelado'), defaultValue: 'pendiente', field: 'estado' },
  address:        { type: DataTypes.TEXT,    field: 'direccion' },
  notes:          { type: DataTypes.TEXT,    field: 'observaciones' },
  createdAt:      { type: DataTypes.DATE,    defaultValue: DataTypes.NOW, field: 'created_at' },
}, {
  tableName: 'turnos',
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Appointment;
