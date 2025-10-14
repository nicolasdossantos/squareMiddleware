/**
 * Validation Middleware
 * Request validation using input validation utilities
 */

const { sanitizeInput } = require('../utils/security');
const { sendValidationError, sendError } = require('../utils/responseBuilder');
const { logSecurityEvent } = require('../utils/logger');

/**
 * Simple security threat detection
 */
function checkSecurityThreats(value, _req) {
  if (typeof value !== 'string') return false;

  // Check for common injection patterns
  const threatPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /document\./gi,
    /window\./gi
  ];

  return threatPatterns.some(pattern => pattern.test(value));
}

/**
 * Security validation middleware
 */
function securityValidation(req, res, next) {
  try {
    // Check all string inputs for security threats
    const checkInput = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'string') {
          if (checkSecurityThreats(value, req)) {
            logSecurityEvent(
              'security_threat_detected',
              {
                field: currentPath,
                value: value.substring(0, 100)
              },
              req
            );

            return sendError(res, 'Invalid input detected', 403);
          }
        } else if (typeof value === 'object' && value !== null) {
          const result = checkInput(value, currentPath);
          if (result) return result;
        }
      }
      return null;
    };

    // Check body, query, and params
    if (req.body && typeof req.body === 'object') {
      const result = checkInput(req.body);
      if (result) return result;
    }

    if (req.query && typeof req.query === 'object') {
      const result = checkInput(req.query);
      if (result) return result;
    }

    if (req.params && typeof req.params === 'object') {
      const result = checkInput(req.params);
      if (result) return result;
    }

    next();
  } catch (error) {
    logSecurityEvent(
      'security_validation_error',
      {
        error: error.message
      },
      req
    );

    next(error);
  }
}

/**
 * Sanitization middleware
 */
function sanitizeInputs(req, res, next) {
  try {
    // Sanitize all string inputs
    const sanitizeObject = obj => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          obj[key] = sanitizeInput(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitizeObject(value);
        }
      }
    };

    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      sanitizeObject(req.query);
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
      sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Content type validation middleware
 */
function validateContentType(expectedTypes = ['application/json']) {
  return (req, res, next) => {
    // Skip validation for GET requests and requests without body
    if (req.method === 'GET' || !req.body || Object.keys(req.body).length === 0) {
      return next();
    }

    const contentType = req.get('content-type');

    if (!contentType) {
      return sendValidationError(res, ['Content-Type header is required']);
    }

    const isValidType = expectedTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()));

    if (!isValidType) {
      return sendValidationError(res, [`Invalid Content-Type. Expected: ${expectedTypes.join(', ')}`]);
    }

    next();
  };
}

/**
 * Request size validation middleware
 */
function validateRequestSize(maxSizeBytes = 10 * 1024 * 1024) {
  // 10MB default
  return (req, res, next) => {
    const contentLength = req.get('content-length');

    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return sendValidationError(res, [`Request size too large. Maximum: ${maxSizeBytes} bytes`]);
    }

    next();
  };
}

/**
 * Custom validation middleware factory
 */
function validateSchema(validationFunction) {
  return (req, res, next) => {
    try {
      const errors = validationFunction(req.body);

      if (errors && errors.length > 0) {
        return sendValidationError(res, errors);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  securityValidation,
  sanitizeInputs,
  validateContentType,
  validateRequestSize,
  validateSchema
};
