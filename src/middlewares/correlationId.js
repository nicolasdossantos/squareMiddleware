/**
 * Correlation ID Middleware
 * Adds unique correlation ID to each request for tracing
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Generate or extract correlation ID from request
 */
function correlationId(req, res, next) {
  // Check if correlation ID already exists in headers
  let correlationId = req.headers['x-correlation-id'];

  // If not provided, generate a new one
  if (!correlationId) {
    correlationId = uuidv4();
  }

  // Attach to request object
  req.correlationId = correlationId;

  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

module.exports = correlationId;
