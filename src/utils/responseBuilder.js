const { getSecurityHeaders } = require('./security');

/**
 * Build standardized HTTP responses for Azure Functions
 */

/**
 * Create a success response
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code (default: 200)
 * @param {string} correlationId - Correlation ID for tracking
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Azure Function response object
 */
function createSuccessResponse(data, status = 200, correlationId = null, additionalHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getSecurityHeaders(),
    ...additionalHeaders
  };

  if (correlationId) {
    headers['X-Correlation-ID'] = correlationId;
  }

  return {
    status,
    headers,
    jsonBody: {
      success: true,
      ...data,
      ...(correlationId && { correlation_id: correlationId })
    }
  };
}

/**
 * Create an error response
 * @param {number} status - HTTP status code
 * @param {string} error - Error message
 * @param {string|Object} details - Error details (string or object)
 * @param {string} correlationId - Correlation ID for tracking
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Azure Function response object
 */
function createErrorResponse(status, error, details = null, correlationId = null, additionalHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getSecurityHeaders(),
    ...additionalHeaders
  };

  if (correlationId) {
    headers['X-Correlation-ID'] = correlationId;
  }

  const jsonBody = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    ...(details && { details }),
    ...(correlationId && { correlation_id: correlationId })
  };

  return {
    status,
    headers,
    jsonBody
  };
}

/**
 * Create a validation error response
 * @param {string|Array} errors - Validation error(s)
 * @param {string} correlationId - Correlation ID for tracking
 * @returns {Object} Azure Function response object
 */
function createValidationErrorResponse(errors, correlationId = null) {
  return createErrorResponse(
    400,
    'Validation failed',
    Array.isArray(errors) ? errors : [errors],
    correlationId
  );
}

/**
 * Create a rate limit exceeded response
 * @param {string} message - Rate limit message
 * @param {number} resetTime - Reset time in seconds
 * @param {string} correlationId - Correlation ID for tracking
 * @returns {Object} Azure Function response object
 */
function createRateLimitResponse(message, resetTime = 60, correlationId = null) {
  return createErrorResponse(429, message, null, correlationId, {
    'Retry-After': resetTime.toString(),
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': resetTime.toString()
  });
}

/**
 * Create an internal server error response
 * @param {string} message - Error message
 * @param {string} correlationId - Correlation ID for tracking
 * @returns {Object} Azure Function response object
 */
function createInternalErrorResponse(message = 'Internal server error', correlationId = null) {
  return createErrorResponse(500, message, null, correlationId);
}

/**
 * Create a method not allowed response
 * @param {string} allowedMethods - Allowed HTTP methods
 * @param {string} correlationId - Correlation ID for tracking
 * @returns {Object} Azure Function response object
 */
function createMethodNotAllowedResponse(
  allowedMethods = 'GET, POST, PUT, DELETE, OPTIONS',
  correlationId = null
) {
  return createErrorResponse(405, 'Method not allowed', `Allowed methods: ${allowedMethods}`, correlationId, {
    Allow: allowedMethods
  });
}

/**
 * Create a not found response
 * @param {string} resource - Resource that was not found
 * @param {string} correlationId - Correlation ID for tracking
 * @returns {Object} Azure Function response object
 */
function createNotFoundResponse(resource = 'Resource', correlationId = null) {
  return createErrorResponse(404, `${resource} not found`, null, correlationId);
}

/**
 * Express.js Response Helpers
 * These functions work directly with Express.js res objects
 */

/**
 * Send a success response for Express.js
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {number} status - HTTP status code (default: 200)
 * @param {string} correlationId - Correlation ID for tracking
 */
function sendSuccess(res, data, message = 'Success', status = 200, correlationId = null) {
  const response = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };

  if (correlationId) {
    response.correlation_id = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // Set security headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(status).json(response);
}

/**
 * Send an error response for Express.js
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 500)
 * @param {string|Object} details - Error details (will be stringified to avoid circular refs)
 * @param {string} correlationId - Correlation ID for tracking
 */
function sendError(
  res,
  message = 'Internal server error',
  status = 500,
  details = null,
  correlationId = null
) {
  const response = {
    success: false,
    error: message,
    message,
    timestamp: new Date().toISOString()
  };

  // CRITICAL: Always convert details to string to avoid circular reference errors
  // When details is an object with circular refs, JSON.stringify will fail
  if (details) {
    // If it's a string, use as-is
    // If it's an Error object, extract message
    // Otherwise, convert to string safely
    if (typeof details === 'string') {
      response.details = details;
    } else if (details instanceof Error) {
      response.details = details.message || details.toString();
    } else if (typeof details === 'object') {
      // Try to stringify, but fall back to toString if it has circular refs
      try {
        response.details = JSON.stringify(details);
      } catch (e) {
        response.details = details.toString();
      }
    } else {
      response.details = String(details);
    }
  }

  if (correlationId) {
    response.correlation_id = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
  }

  // Set security headers
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(status).json(response);
}

/**
 * Send a not found response for Express.js
 * @param {Object} res - Express response object
 * @param {string} resource - Resource that was not found
 * @param {string} message - Custom message (optional)
 * @param {string} correlationId - Correlation ID for tracking
 */
function sendNotFound(res, resource = 'Resource', message = null, correlationId = null) {
  const errorMessage = message || `${resource} not found`;
  return sendError(res, errorMessage, 404, null, correlationId);
}

/**
 * Send a validation error response for Express.js
 * @param {Object} res - Express response object
 * @param {string|Array} errors - Validation error(s)
 * @param {string} message - Error message
 * @param {string} correlationId - Correlation ID for tracking
 */
function sendValidationError(res, errors, message = 'Validation failed', correlationId = null) {
  return sendError(res, message, 400, Array.isArray(errors) ? errors : [errors], correlationId);
}

module.exports = {
  // Azure Functions response builders (legacy)
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createRateLimitResponse,
  createInternalErrorResponse,
  createMethodNotAllowedResponse,
  createNotFoundResponse,

  // Express.js response helpers (current)
  sendSuccess,
  sendError,
  sendNotFound,
  sendValidationError
};
