/**
 * Enhanced Logging Utility
 * Winston-based structured logging with correlation IDs and performance tracking
 */
const winston = require('winston');
const { getConfig } = require('./config');

// Get configuration
const config = getConfig();

// Current log level cache
let currentLogLevel = null;

/**
 * Log levels for compatibility
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Get the current log level as number
 */
function getCurrentLogLevel() {
  if (currentLogLevel !== null) {
    const level = LOG_LEVELS[currentLogLevel];
    return level !== undefined ? level : LOG_LEVELS.INFO;
  }

  // Default from environment first, then config, then 'info'
  const envLevel = process.env.LOG_LEVEL || 'info';
  const level = LOG_LEVELS[envLevel.toUpperCase()];
  return level !== undefined ? level : LOG_LEVELS.INFO;
}

/**
 * Check if we should log at this level
 */
function shouldLog(level) {
  const currentLevel = getCurrentLogLevel();
  const requestedLevel = LOG_LEVELS[level];
  return requestedLevel >= currentLevel;
}

/**
 * Create a structured log entry
 */
function createLogEntry(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();

  // Provide default values if not present
  const correlationId = metadata.correlation_id || 'unknown';
  const functionName = metadata.function_name || 'unknown';

  const logEntry = {
    timestamp,
    level,
    message,
    correlation_id: correlationId,
    function_name: functionName,
    ...metadata
  };
  return JSON.stringify(logEntry);
}

/**
 * Custom log format for Winston
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(info => {
    const { timestamp, level, message, correlationId, duration, stack, ...meta } = info;
    const logEntry = {
      timestamp,
      level,
      message,
      ...(correlationId && { correlationId }),
      ...(duration && { duration }),
      ...(Object.keys(meta).length > 0 && { meta }),
      ...(stack && { stack })
    };
    return JSON.stringify(logEntry);
  })
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'square-booking-api',
    version: process.env.npm_package_version || '2.0.0'
  },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format:
        config.NODE_ENV === 'development'
          ? winston.format.combine(winston.format.colorize(), winston.format.simple())
          : logFormat
    })
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()]
});

/**
 * Set log level dynamically
 */
function setLogLevel(level) {
  currentLogLevel = level.toUpperCase();
  if (logger) {
    logger.level = level.toLowerCase();
  }
}

/**
 * Reset log level to environment default (for testing)
 */
function resetLogLevel() {
  currentLogLevel = null;
  if (logger) {
    logger.level = config.LOG_LEVEL || 'info';
  }
}

/**
 * Direct logging functions for compatibility
 */
function debug(message, metadata = {}, context = null) {
  if (context) {
    // Azure Functions context provided
    if (context.log && typeof context.log === 'function') {
      const logData = {
        level: 'DEBUG',
        correlation_id: context.invocationId || 'unknown',
        function_name: context.functionName || 'unknown',
        ...metadata
      };
      context.log(message, logData);
    }
  } else if (shouldLog('DEBUG')) {
    console.log(createLogEntry('DEBUG', message, metadata));
  }
}

function info(message, metadata = {}, context = null) {
  if (context) {
    // Azure Functions context provided
    if (context.log && typeof context.log === 'function') {
      const logData = {
        level: 'INFO',
        correlation_id: context.invocationId || 'unknown',
        function_name: context.functionName || 'unknown',
        ...metadata
      };
      context.log(message, logData);
    }
  } else if (shouldLog('INFO')) {
    console.log(createLogEntry('INFO', message, metadata));
  }
}

function warn(message, metadata = {}, context = null) {
  if (context) {
    // Azure Functions context provided
    if (context.log && context.log.warn && typeof context.log.warn === 'function') {
      const logData = {
        level: 'WARN',
        correlation_id: context.invocationId || 'unknown',
        function_name: context.functionName || 'unknown',
        ...metadata
      };
      context.log.warn(message, logData);
    }
  } else if (shouldLog('WARN')) {
    console.log(createLogEntry('WARN', message, metadata));
  }
}

function error(message, metadata = {}, context = null) {
  if (context) {
    // Azure Functions context provided
    if (context.log && context.log.error && typeof context.log.error === 'function') {
      const logData = {
        level: 'ERROR',
        correlation_id: context.invocationId || 'unknown',
        function_name: context.functionName || 'unknown',
        ...metadata
      };
      context.log.error('❌ ERROR:', message, logData);
    }
  } else if (shouldLog('ERROR')) {
    console.log(createLogEntry('ERROR', message, metadata));
  }
}

/**
 * API lifecycle logging functions
 */
function logApiStart(operationName, metadata = {}) {
  if (shouldLog('DEBUG')) {
    debug(`🚀 ${operationName} started`, {
      operation: operationName,
      stage: 'start',
      ...metadata
    });
  }
}

function logApiSuccess(operationName, duration, metadata = {}, context = null) {
  const message = `✅ ${operationName} completed`;
  const logData = {
    operation: operationName,
    duration_ms: duration,
    stage: 'success',
    success: true,
    level: 'INFO',
    ...metadata
  };
  if (context) {
    if (context.log && typeof context.log === 'function') {
      context.log(message, logData);
    }
  } else {
    info(message, logData);
  }
}

function logApiError(operationName, duration, errorObj, metadata = {}, context = null) {
  const message = `❌ ${operationName} failed`;
  const logData = {
    operation: operationName,
    duration_ms: duration,
    stage: 'error',
    success: false,
    error_message: errorObj.message,
    error_type: errorObj.constructor.name,
    level: 'ERROR',
    ...metadata
  };
  if (context) {
    if (context.log && context.log.error && typeof context.log.error === 'function') {
      context.log.error('❌ ERROR:', message, logData);
    }
  } else {
    // Use our error function directly
    if (shouldLog('ERROR')) {
      console.log(createLogEntry('ERROR', message, logData));
    }
  }
}

/**
 * Rate limiting logging
 */
function logRateLimit(clientId, allowed, remaining, metadata = {}) {
  if (allowed) {
    if (shouldLog('DEBUG')) {
      debug(`Rate limit check passed for ${clientId}`, {
        client_id: clientId,
        allowed,
        remaining,
        operation: 'rate_limit_check',
        ...metadata
      });
    }
  } else {
    if (shouldLog('WARN')) {
      warn(`Rate limit exceeded for ${clientId}`, {
        client_id: clientId,
        allowed,
        remaining,
        operation: 'rate_limit_check',
        ...metadata
      });
    }
  }
}

/**
 * Performance logging helper
 */
function logPerformance(correlationId, operation, startTime, metadata = {}) {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation}`, {
    correlationId,
    operation,
    duration,
    ...metadata
  });
  return duration;
}

/**
 * Error logging helper with context
 */
function logError(error, context = {}) {
  logger.error(error.message, {
    stack: error.stack,
    ...context
  });
}

/**
 * Request logging helper with sensitive header redaction
 */
function logRequest(req, res, startTime) {
  const duration = Date.now() - startTime;
  const correlationId = req.headers['x-correlation-id'] || req.correlationId;

  // Redact sensitive headers from logs
  const sensitiveHeaders = ['authorization', 'x-api-key', 'x-retell-api-key', 'cookie'];
  const redactedHeaders = {};

  sensitiveHeaders.forEach(headerName => {
    if (req.headers[headerName]) {
      redactedHeaders[headerName] = '[REDACTED]';
    }
  });

  logger.info('HTTP Request', {
    correlationId,
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    contentLength: res.get('content-length'),
    ...(Object.keys(redactedHeaders).length > 0 && { redactedHeaders })
  });
}

/**
 * Business event logging
 */
function logEvent(eventName, data = {}, correlationId = null) {
  logger.info(`Event: ${eventName}`, {
    event: eventName,
    correlationId,
    ...data
  });
}

/**
 * Security event logging
 */
function logSecurityEvent(eventType, details = {}, req = null) {
  logger.warn(`Security: ${eventType}`, {
    securityEvent: eventType,
    ip: req?.ip,
    userAgent: req?.get('user-agent'),
    correlationId: req?.correlationId,
    ...details
  });
}

// Create the main module exports object with all functions attached directly
const loggerModule = {
  LOG_LEVELS,
  logger,
  setLogLevel,
  resetLogLevel,
  debug,
  info,
  warn,
  error,
  logApiStart,
  logApiSuccess,
  logApiError,
  logRateLimit,
  logPerformance,
  logError,
  logRequest,
  logEvent,
  logSecurityEvent
};

// Make functions available directly on the module for test compatibility
loggerModule.resetLogLevel = resetLogLevel;
loggerModule.setLogLevel = setLogLevel;
loggerModule.debug = debug;
loggerModule.info = info;
loggerModule.warn = warn;
loggerModule.error = error;

module.exports = loggerModule;
