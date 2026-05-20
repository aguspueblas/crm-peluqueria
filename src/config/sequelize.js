'use strict';

const { Sequelize } = require('sequelize');

const sharedOptions = {
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true,
    timestamps: false,
  },
  dialectOptions: process.env.DATABASE_URL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, sharedOptions)
  : new Sequelize({
      ...sharedOptions,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

module.exports = sequelize;
