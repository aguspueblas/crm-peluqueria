'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Turno = sequelize.define('Turno', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cliente_id:     { type: DataTypes.INTEGER, allowNull: false },
  profesional_id: { type: DataTypes.INTEGER, allowNull: false },
  servicio_id:    { type: DataTypes.INTEGER, allowNull: false },
  fecha_hora:     { type: DataTypes.DATE, allowNull: false },
  estado:         { type: DataTypes.STRING(20), defaultValue: 'pendiente' },
  created_at:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'turnos',
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Turno;
