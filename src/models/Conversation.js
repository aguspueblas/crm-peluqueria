'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Conversation = sequelize.define('Conversation', {
  id:         { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  businessId: { type: DataTypes.INTEGER,    allowNull: false, field: 'negocio_id' },
  phone:      { type: DataTypes.STRING(20), allowNull: false, field: 'telefono' },
  messages:   { type: DataTypes.JSONB,      allowNull: false, defaultValue: [], field: 'messages' },
  status:     { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active', field: 'estado' },
}, {
  tableName: 'conversaciones',
  createdAt: false,
  updatedAt: 'updated_at',
});

module.exports = Conversation;
