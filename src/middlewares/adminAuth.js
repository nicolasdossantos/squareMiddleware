/**
 * Admin Authentication Middleware
 *
 * Simple HTTP Basic Auth for admin endpoints
 * For production, consider using OAuth or JWT
 */

const { logger } = require('../utils/logger');

// Admin credentials from environment
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-in-production';

module.exports = function adminAuth(req, res, next) {
  // Extract Basic Auth credentials
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    logger.warn('Admin access attempted without credentials', {
      ip: req.ip,
      path: req.path
    });

    res.set('WWW-Authenticate', 'Basic realm="Admin Access"');
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  try {
    // Decode Base64 credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // Validate credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      logger.info('Admin authenticated successfully', {
        username,
        ip: req.ip,
        path: req.path
      });
      return next();
    }

    logger.warn('Admin authentication failed - invalid credentials', {
      username,
      ip: req.ip,
      path: req.path
    });

    res.set('WWW-Authenticate', 'Basic realm="Admin Access"');
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  } catch (error) {
    logger.error('Admin authentication error', { error: error.message });

    res.set('WWW-Authenticate', 'Basic realm="Admin Access"');
    return res.status(401).json({
      error: 'Authentication failed'
    });
  }
};
