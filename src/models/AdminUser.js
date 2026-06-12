'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AdminUser = sequelize.define('AdminUser', {
  id:        { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  nombre:    { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Admin' },
  telefono:  { type: DataTypes.STRING(20),  allowNull: false, unique: true },
  activo:    { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true },
  createdAt: { type: DataTypes.DATE,        field: 'created_at' },
}, {
  tableName:  'admin_users',
  timestamps: false,
});

module.exports = AdminUser;
