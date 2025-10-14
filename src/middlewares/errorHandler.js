/**
 * Error Handling Middleware
 * Centralized error handling with structured logging
 */

const { logError } = require('../utils/logger');
const { sendError } = require('../utils/responseBuilder');

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, _next) {
  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = err.details;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
  } else if (err.statusCode || err.status) {
    statusCode = err.statusCode || err.status;
    message = err.message || message;
  } else if (err.message) {
    message = err.message;
  }

  // Log the error with context
  logError(err, {
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    statusCode,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });

  // Don't send details in production
  if (process.env.NODE_ENV === 'production') {
    details = null;
  }

  // Send error response
  sendError(res, message, statusCode, details);
}

/**
 * 404 handler middleware
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.url}`);
  error.name = 'NotFoundError';
  error.statusCode = 404;
  next(error);
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
