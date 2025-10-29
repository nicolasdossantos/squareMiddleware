/**
 * Admin Authentication Middleware
 * Protects admin endpoints with API key authentication
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * Admin API key authentication
 * Requires X-Admin-API-Key header matching ADMIN_API_KEY environment variable
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function adminAuth(req, res, next) {
  const apiKey = req.headers['x-admin-api-key'];
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey) {
    logger.error('ADMIN_API_KEY not configured');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Admin API key not configured'
    });
  }

  if (!apiKey) {
    logger.warn('Admin endpoint accessed without API key', {
      ip: req.ip,
      path: req.path,
      correlationId: req.correlationId
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'X-Admin-API-Key header required'
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  const providedKey = Buffer.from(apiKey, 'utf8');
  const expectedKey = Buffer.from(configuredKey, 'utf8');

  let isValid = false;
  if (providedKey.length === expectedKey.length) {
    try {
      isValid = crypto.timingSafeEqual(providedKey, expectedKey);
    } catch (error) {
      logger.error('Failed to compare admin API keys securely', {
        error: error.message,
        path: req.path,
        correlationId: req.correlationId
      });

      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Admin authentication failed'
      });
    }
  }

  if (!isValid) {
    logger.warn('Admin authentication failed - invalid API key', {
      ip: req.ip,
      path: req.path,
      correlationId: req.correlationId
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  logger.info('Admin authenticated successfully', {
    ip: req.ip,
    path: req.path,
    correlationId: req.correlationId
  });

  next();
}

module.exports = adminAuth;
