const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Configure winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'nas-cors-server' },
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Access log file (for user activities)
        new winston.transports.File({
            filename: path.join(logsDir, 'access.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
                })
            )
        })
    ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Helper functions for common log types
const logAuth = (action, username, ip, success = true, details = '') => {
    logger.info(`AUTH: ${action}`, {
        username,
        ip,
        success,
        details,
        category: 'authentication'
    });
};

const logFileAccess = (action, filepath, username, ip, success = true) => {
    logger.info(`FILE: ${action}`, {
        filepath,
        username,
        ip,
        success,
        category: 'file_access'
    });
};

const logAdmin = (action, adminUser, targetUser, ip, details = '') => {
    logger.info(`ADMIN: ${action}`, {
        adminUser,
        targetUser,
        ip,
        details,
        category: 'administration'
    });
};

const logError = (error, context = '', username = '', ip = '') => {
    logger.error(`ERROR: ${context}`, {
        error: error.message,
        stack: error.stack,
        username,
        ip,
        category: 'error'
    });
};

const logSystem = (message, details = {}) => {
    logger.info(`SYSTEM: ${message}`, {
        ...details,
        category: 'system'
    });
};

module.exports = {
    logger,
    logAuth,
    logFileAccess,
    logAdmin,
    logError,
    logSystem
};