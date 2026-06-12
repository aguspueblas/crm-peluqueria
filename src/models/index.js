'use strict';

const Business              = require('./Business');
const Professional          = require('./Professional');
const ProfessionalSchedule  = require('./ProfessionalSchedule');
const Client                = require('./Client');
const Service               = require('./Service');
const Appointment           = require('./Appointment');
const Conversation          = require('./Conversation');
const AdminUser             = require('./AdminUser');
const AdminConversation     = require('./AdminConversation');

// Business → dependents
Business.hasMany(Professional,  { foreignKey: 'businessId' });
Business.hasMany(Client,        { foreignKey: 'businessId' });
Business.hasMany(Service,       { foreignKey: 'businessId' });
Business.hasMany(Appointment,   { foreignKey: 'businessId' });
Business.hasMany(Conversation,  { foreignKey: 'businessId' });

Professional.belongsTo(Business, { foreignKey: 'businessId' });
Client.belongsTo(Business,       { foreignKey: 'businessId' });
Service.belongsTo(Business,      { foreignKey: 'businessId' });
Appointment.belongsTo(Business,  { foreignKey: 'businessId' });
Conversation.belongsTo(Business, { foreignKey: 'businessId' });

// Professional ↔ Schedules
Professional.hasMany(ProfessionalSchedule, { as: 'schedules', foreignKey: 'professionalId' });
ProfessionalSchedule.belongsTo(Professional, { foreignKey: 'professionalId' });

// Appointment → related entities
Appointment.belongsTo(Client,       { foreignKey: 'clientId' });
Appointment.belongsTo(Professional, { foreignKey: 'professionalId' });
Appointment.belongsTo(Service,      { foreignKey: 'serviceId' });
Client.hasMany(Appointment,         { foreignKey: 'clientId' });
Professional.hasMany(Appointment,   { foreignKey: 'professionalId' });

// AdminUser ↔ Business (many-to-many via admin_negocio)
AdminUser.belongsToMany(Business, { through: 'admin_negocio', foreignKey: 'admin_user_id', otherKey: 'negocio_id' });
Business.belongsToMany(AdminUser, { through: 'admin_negocio', foreignKey: 'negocio_id', otherKey: 'admin_user_id' });

// AdminConversation associations
AdminUser.hasMany(AdminConversation,    { foreignKey: 'adminUserId' });
AdminConversation.belongsTo(AdminUser,  { foreignKey: 'adminUserId' });
AdminConversation.belongsTo(Business,   { foreignKey: 'businessId' });

module.exports = { Business, Professional, ProfessionalSchedule, Client, Service, Appointment, Conversation, AdminUser, AdminConversation };
