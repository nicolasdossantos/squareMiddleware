const analyticsService = require('../services/analyticsService');
const { logger } = require('../utils/logger');

async function getTenantAnalytics(req, res) {
  try {
    const tenantId = req.user?.tenantId || req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const analytics = await analyticsService.getTenantAnalytics(tenantId);

    return res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('get_tenant_analytics_failed', {
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'analytics_failed',
      message: 'Failed to load analytics'
    });
  }
}

module.exports = {
  getTenantAnalytics
};
