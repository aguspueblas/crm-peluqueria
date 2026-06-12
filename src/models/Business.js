'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Business = sequelize.define('Business', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:          { type: DataTypes.STRING(100), allowNull: false,  field: 'nombre' },
  sector:        { type: DataTypes.STRING(100), allowNull: false,  field: 'rubro' },
  apiKey:        { type: DataTypes.STRING(64),  allowNull: false,  unique: true, field: 'api_key' },
  whatsappNumber:{ type: DataTypes.STRING(20),  unique: true,      field: 'whatsapp_number' },
  active:        { type: DataTypes.BOOLEAN,     defaultValue: true, field: 'activo' },
  agentName:     { type: DataTypes.STRING(100),                    field: 'agente_nombre' },
  systemPrompt:  { type: DataTypes.TEXT,                           field: 'system_prompt' },
  panelEmail:    { type: DataTypes.STRING(200),                    field: 'panel_email' },
  panelPassword: { type: DataTypes.TEXT,                           field: 'panel_password' },
}, {
  tableName: 'negocios',
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Business;
