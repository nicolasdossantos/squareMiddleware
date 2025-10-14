/**
 * Request Logging Middleware
 * HTTP request/response logging with performance tracking
 */

const { logRequest, logError } = require('../utils/logger');

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  // Record start time
  const startTime = Date.now();

  // Store original end method
  const originalEnd = res.end;

  // Override end method to log when response is sent
  res.end = function (...args) {
    // Call original end method
    originalEnd.apply(this, args);

    // Log the request
    try {
      logRequest(req, res, startTime);
    } catch (error) {
      logError(error, {
        correlationId: req.correlationId,
        context: 'request_logging_middleware'
      });
    }
  };

  next();
}

module.exports = requestLogger;
