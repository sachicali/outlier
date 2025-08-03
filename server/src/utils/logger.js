const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, correlationId, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      correlationId: correlationId || 'system',
      service: 'outlier-discovery',
      environment: process.env.NODE_ENV || 'development',
      ...meta,
    };

    if (stack) {
      logEntry.stack = stack;
    }

    return JSON.stringify(logEntry);
  }),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const corrId = correlationId ? ` [${correlationId}]` : '';
    return `${timestamp} ${level}${corrId}: ${message}${metaStr}`;
  }),
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'outlier-discovery',
    version: process.env.npm_package_version || '1.0.0',
    hostname: require('os').hostname(),
    pid: process.pid,
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true,
    }),
    // All logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true,
    }),
    // Audit logs for important operations
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format((info) => {
          // Only log audit-worthy events
          if (info.audit === true) {
            return info;
          }
          return false;
        })(),
      ),
      maxsize: 10485760,
      maxFiles: 20,
      tailable: true,
    }),
  ],
});

// If we're not in production, log to console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Enhanced logger with additional utility methods
const enhancedLogger = {
  ...logger,

  // Log with correlation ID
  withCorrelation: (correlationId) => ({
    debug: (message, meta = {}) => logger.debug(message, { correlationId, ...meta }),
    info: (message, meta = {}) => logger.info(message, { correlationId, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { correlationId, ...meta }),
    error: (message, meta = {}) => logger.error(message, { correlationId, ...meta }),
  }),

  // Audit logging for important operations
  audit: (message, meta = {}) => {
    logger.info(message, { ...meta, audit: true });
  },

  // Performance logging
  performance: (operation, duration, meta = {}) => {
    logger.info(`Performance: ${operation} completed in ${duration}ms`, {
      ...meta,
      performance: true,
      operation,
      duration,
    });
  },

  // Security logging
  security: (event, meta = {}) => {
    logger.warn(`Security: ${event}`, {
      ...meta,
      security: true,
      event,
    });
  },

  // Business logic logging
  business: (event, meta = {}) => {
    logger.info(`Business: ${event}`, {
      ...meta,
      business: true,
      event,
    });
  },

  // Request timing middleware helper
  createTimingLogger: (correlationId) => {
    const startTime = Date.now();
    return {
      end: (operation) => {
        const duration = Date.now() - startTime;
        enhancedLogger.performance(operation, duration, { correlationId });
      },
    };
  },
};

module.exports = enhancedLogger;
