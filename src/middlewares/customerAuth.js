const authService = require('../services/authService');
const { logger } = require('../utils/logger');

async function customerAuth(req, res, next) {
  try {
    const header = req.headers.authorization || req.headers.Authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authorization header with Bearer token required'
      });
    }

    const token = header.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Bearer token missing'
      });
    }

    const payload = await authService.verifyAccessToken(token);

    req.auth = payload;
    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email
    };

    return next();
  } catch (error) {
    logger.warn('customer_auth_failed', { message: error.message });
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Invalid or expired access token'
    });
  }
}

module.exports = customerAuth;
