'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AdminConversation = sequelize.define('AdminConversation', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  adminUserId: { type: DataTypes.INTEGER, allowNull: false, field: 'admin_user_id' },
  businessId:  { type: DataTypes.INTEGER, allowNull: false, field: 'negocio_id' },
  messages:    { type: DataTypes.JSONB,   allowNull: false, defaultValue: [] },
  updatedAt:   { type: DataTypes.DATE,    field: 'updated_at' },
}, {
  tableName: 'admin_conversaciones',
  createdAt: false,
  updatedAt: 'updated_at',
});

module.exports = AdminConversation;
