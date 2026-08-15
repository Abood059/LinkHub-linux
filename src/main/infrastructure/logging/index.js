// src/main/infrastructure/logging/index.js
'use strict';

const ErrorCentralService = require('./ErrorCentralService');
const {
    LOG_LEVELS,
    LOG_TYPES,
    LOG_SOURCES,
    SEVERITY
} = require('./logging.constants');

// إنشاء instance واحد فقط (Singleton)
const errorCentralService = new ErrorCentralService();

module.exports = Object.freeze({
    errorCentralService,  // الـ instance الجاهز للاستخدام
    ErrorCentralService,  // الكلاس (في حال الحاجة لإنشاء إضافي، لكن نادراً)
    LOG_LEVELS,
    LOG_TYPES,
    LOG_SOURCES,
    SEVERITY
});