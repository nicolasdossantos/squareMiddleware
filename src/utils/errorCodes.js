/**
 * Standardized Error Codes and Error Creation Utilities
 *
 * This module provides a centralized error code system for consistent
 * error handling across the application. All errors should use these
 * standardized codes for better tracking, debugging, and monitoring.
 *
 * Error Code Categories:
 * - 1xxx: Authentication & Authorization
 * - 2xxx: Validation Errors
 * - 3xxx: Booking Errors
 * - 4xxx: Customer Errors
 * - 5xxx: Square API Errors
 * - 6xxx: Webhook Errors
 * - 7xxx: System Errors
 *
 * Usage:
 * ```javascript
 * const { createError } = require('../utils/errorCodes');
 *
 * // In controller or service:
 * throw createError('BOOKING_NOT_FOUND', {
 *   bookingId: id
 * }, req.correlationId);
 * ```
 */

/**
 * Error Code Definitions
 * Each entry contains: code (numeric), status (HTTP), message (default)
 */
const ErrorCodes = {
  // ============================================================
  // 1xxx: AUTHENTICATION & AUTHORIZATION
  // ============================================================

  AUTH_MISSING_TOKEN: {
    code: 1001,
    status: 401,
    message: 'Authentication token required'
  },

  AUTH_INVALID_TOKEN: {
    code: 1002,
    status: 401,
    message: 'Invalid authentication token'
  },

  AUTH_TOKEN_EXPIRED: {
    code: 1003,
    status: 401,
    message: 'Authentication token has expired'
  },

  AUTH_SESSION_EXPIRED: {
    code: 1004,
    status: 401,
    message: 'Session has expired'
  },

  AUTH_SESSION_NOT_FOUND: {
    code: 1005,
    status: 401,
    message: 'Session not found'
  },

  AUTH_INSUFFICIENT_PERMISSIONS: {
    code: 1006,
    status: 403,
    message: 'Insufficient permissions for this operation'
  },

  AUTH_INVALID_SIGNATURE: {
    code: 1007,
    status: 401,
    message: 'Invalid request signature'
  },

  AUTH_TENANT_NOT_FOUND: {
    code: 1008,
    status: 404,
    message: 'Tenant configuration not found'
  },

  // ============================================================
  // 2xxx: VALIDATION ERRORS
  // ============================================================

  VALIDATION_MISSING_FIELD: {
    code: 2001,
    status: 400,
    message: 'Required field is missing'
  },

  VALIDATION_INVALID_FORMAT: {
    code: 2002,
    status: 400,
    message: 'Invalid field format'
  },

  VALIDATION_OUT_OF_RANGE: {
    code: 2003,
    status: 400,
    message: 'Value is out of acceptable range'
  },

  VALIDATION_INVALID_PHONE: {
    code: 2004,
    status: 400,
    message: 'Invalid phone number format'
  },

  VALIDATION_INVALID_EMAIL: {
    code: 2005,
    status: 400,
    message: 'Invalid email address format'
  },

  VALIDATION_INVALID_DATE: {
    code: 2006,
    status: 400,
    message: 'Invalid date or time format'
  },

  VALIDATION_PAST_DATE: {
    code: 2007,
    status: 400,
    message: 'Date cannot be in the past'
  },

  VALIDATION_INVALID_DURATION: {
    code: 2008,
    status: 400,
    message: 'Invalid service duration'
  },

  // ============================================================
  // 3xxx: BOOKING ERRORS
  // ============================================================

  BOOKING_NOT_FOUND: {
    code: 3001,
    status: 404,
    message: 'Booking not found'
  },

  BOOKING_SLOT_UNAVAILABLE: {
    code: 3002,
    status: 409,
    message: 'The requested time slot is no longer available'
  },

  BOOKING_CONFLICT: {
    code: 3003,
    status: 409,
    message: 'Booking conflicts with existing appointment'
  },

  BOOKING_CREATION_FAILED: {
    code: 3004,
    status: 500,
    message: 'Failed to create booking'
  },

  BOOKING_UPDATE_FAILED: {
    code: 3005,
    status: 500,
    message: 'Failed to update booking'
  },

  BOOKING_CANCEL_FAILED: {
    code: 3006,
    status: 500,
    message: 'Failed to cancel booking'
  },

  BOOKING_ALREADY_CANCELLED: {
    code: 3007,
    status: 400,
    message: 'Booking has already been cancelled'
  },

  BOOKING_TOO_SHORT_NOTICE: {
    code: 3008,
    status: 400,
    message: 'Booking requires more advance notice'
  },

  BOOKING_SERVICE_NOT_FOUND: {
    code: 3009,
    status: 404,
    message: 'Requested service not found'
  },

  BOOKING_TEAM_MEMBER_NOT_FOUND: {
    code: 3010,
    status: 404,
    message: 'Requested team member not available'
  },

  // ============================================================
  // 4xxx: CUSTOMER ERRORS
  // ============================================================

  CUSTOMER_NOT_FOUND: {
    code: 4001,
    status: 404,
    message: 'Customer not found'
  },

  CUSTOMER_CREATION_FAILED: {
    code: 4002,
    status: 500,
    message: 'Failed to create customer'
  },

  CUSTOMER_UPDATE_FAILED: {
    code: 4003,
    status: 500,
    message: 'Failed to update customer'
  },

  CUSTOMER_DUPLICATE: {
    code: 4004,
    status: 409,
    message: 'Customer already exists'
  },

  CUSTOMER_SEARCH_FAILED: {
    code: 4005,
    status: 500,
    message: 'Failed to search customers'
  },

  // ============================================================
  // 5xxx: SQUARE API ERRORS
  // ============================================================

  SQUARE_API_ERROR: {
    code: 5001,
    status: 502,
    message: 'Square API returned an error'
  },

  SQUARE_AUTH_FAILED: {
    code: 5002,
    status: 401,
    message: 'Square authentication failed - invalid access token'
  },

  SQUARE_RATE_LIMIT: {
    code: 5003,
    status: 429,
    message: 'Square API rate limit exceeded'
  },

  SQUARE_TIMEOUT: {
    code: 5004,
    status: 504,
    message: 'Square API request timeout'
  },

  SQUARE_NETWORK_ERROR: {
    code: 5005,
    status: 503,
    message: 'Network error communicating with Square'
  },

  SQUARE_INVALID_REQUEST: {
    code: 5006,
    status: 400,
    message: 'Invalid request sent to Square API'
  },

  SQUARE_RESOURCE_NOT_FOUND: {
    code: 5007,
    status: 404,
    message: 'Resource not found in Square'
  },

  SQUARE_LOCATION_NOT_FOUND: {
    code: 5008,
    status: 404,
    message: 'Square location not found'
  },

  // ============================================================
  // 6xxx: WEBHOOK ERRORS
  // ============================================================

  WEBHOOK_INVALID_SIGNATURE: {
    code: 6001,
    status: 401,
    message: 'Invalid webhook signature'
  },

  WEBHOOK_INVALID_PAYLOAD: {
    code: 6002,
    status: 400,
    message: 'Invalid webhook payload format'
  },

  WEBHOOK_PROCESSING_FAILED: {
    code: 6003,
    status: 500,
    message: 'Webhook processing failed'
  },

  WEBHOOK_EVENT_TYPE_UNKNOWN: {
    code: 6004,
    status: 400,
    message: 'Unknown webhook event type'
  },

  WEBHOOK_DUPLICATE_EVENT: {
    code: 6005,
    status: 200,
    message: 'Duplicate webhook event (already processed)'
  },

  // ============================================================
  // 7xxx: SYSTEM ERRORS
  // ============================================================

  SYSTEM_CONFIGURATION_ERROR: {
    code: 7001,
    status: 500,
    message: 'System configuration error'
  },

  SYSTEM_KEYVAULT_ERROR: {
    code: 7002,
    status: 500,
    message: 'Azure Key Vault error'
  },

  SYSTEM_DATABASE_ERROR: {
    code: 7003,
    status: 500,
    message: 'Database operation failed'
  },

  SYSTEM_EMAIL_FAILED: {
    code: 7004,
    status: 500,
    message: 'Failed to send email notification'
  },

  SYSTEM_SMS_FAILED: {
    code: 7005,
    status: 500,
    message: 'Failed to send SMS notification'
  },

  SYSTEM_CACHE_ERROR: {
    code: 7006,
    status: 500,
    message: 'Cache operation failed'
  },

  SYSTEM_INTERNAL_ERROR: {
    code: 7999,
    status: 500,
    message: 'Internal server error'
  }
};

/**
 * Create a standardized error object
 *
 * @param {string} errorCodeKey - Key from ErrorCodes (e.g., 'BOOKING_NOT_FOUND')
 * @param {Object} [details={}] - Additional error details (e.g., { bookingId: '123' })
 * @param {string} [correlationId=null] - Request correlation ID for tracking
 * @param {string} [customMessage=null] - Optional custom message to override default
 * @returns {Error} Enhanced Error object with standardized properties
 *
 * @example
 * throw createError('BOOKING_NOT_FOUND', { bookingId: id }, req.correlationId);
 *
 * @example
 * throw createError('SQUARE_API_ERROR', {
 *   squareError: err.errors
 * }, correlationId, 'Square booking creation failed');
 */
function createError(errorCodeKey, details = {}, correlationId = null, customMessage = null) {
  const errorDef = ErrorCodes[errorCodeKey];

  if (!errorDef) {
    // If unknown error code, create a generic system error
    const unknownError = new Error(`Unknown error code: ${errorCodeKey}`);
    unknownError.code = 'SYSTEM_INTERNAL_ERROR';
    unknownError.errorCode = 7999;
    unknownError.statusCode = 500;
    unknownError.details = { originalErrorCode: errorCodeKey, ...details };
    unknownError.correlationId = correlationId;
    return unknownError;
  }

  // Create error with custom or default message
  const error = new Error(customMessage || details.message || errorDef.message);

  // Add standardized properties
  error.code = errorCodeKey; // String code (e.g., 'BOOKING_NOT_FOUND')
  error.errorCode = errorDef.code; // Numeric code (e.g., 3001)
  error.statusCode = errorDef.status; // HTTP status (e.g., 404)
  error.details = details; // Additional context
  error.correlationId = correlationId; // Request tracking ID

  // Preserve stack trace
  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, createError);
  }

  return error;
}

/**
 * Check if an error is a specific type
 *
 * @param {Error} error - Error object to check
 * @param {string} errorCodeKey - Error code to check against
 * @returns {boolean} True if error matches the code
 *
 * @example
 * if (isErrorType(err, 'BOOKING_NOT_FOUND')) {
 *   // Handle not found case
 * }
 */
function isErrorType(error, errorCodeKey) {
  return error && error.code === errorCodeKey;
}

/**
 * Check if error is in a category (by numeric code range)
 *
 * @param {Error} error - Error object to check
 * @param {number} categoryPrefix - Category prefix (e.g., 3 for booking, 5 for Square)
 * @returns {boolean} True if error is in the category
 *
 * @example
 * if (isErrorCategory(err, 5)) {
 *   // Handle all Square API errors (5xxx)
 * }
 */
function isErrorCategory(error, categoryPrefix) {
  if (!error || !error.errorCode) return false;

  const categoryStart = categoryPrefix * 1000;
  const categoryEnd = categoryStart + 999;

  return error.errorCode >= categoryStart && error.errorCode <= categoryEnd;
}

/**
 * Extract error information for logging/monitoring
 *
 * @param {Error} error - Error object
 * @returns {Object} Standardized error information
 *
 * @example
 * logger.error('Operation failed', getErrorInfo(err));
 */
function getErrorInfo(error) {
  return {
    code: error.code || 'UNKNOWN',
    errorCode: error.errorCode || 7999,
    statusCode: error.statusCode || 500,
    message: error.message,
    details: error.details || {},
    correlationId: error.correlationId || null,
    stack: error.stack
  };
}

module.exports = {
  ErrorCodes,
  createError,
  isErrorType,
  isErrorCategory,
  getErrorInfo
};
