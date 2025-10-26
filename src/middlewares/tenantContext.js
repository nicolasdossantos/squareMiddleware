/**
 * Tenant Context Middleware
 *
 * Creates req.tenant object with Square credentials for all requests.
 *
 * In development:
 * - Uses environment variables (SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID)
 *
 * In production with agentAuth:
 * - Uses req.retellContext (created by agentAuth middleware)
 *
 * Fallback:
 * - Always falls back to environment variables if retellContext is missing
 */

const { config } = require('../config');
const { logger } = require('../utils/logger');

/**
 * Tenant context middleware
 * Attaches tenant information to request object
 */
function tenantContext(req, res, next) {
  try {
    // Check if agentAuth middleware already set retellContext
    if (req.retellContext) {
      // Use agent-specific credentials from Key Vault
      req.tenant = {
        id: req.retellContext.agentId,
        agentId: req.retellContext.agentId,
        accessToken: req.retellContext.squareAccessToken,
        locationId: req.retellContext.squareLocationId,
        squareAccessToken: req.retellContext.squareAccessToken,
        squareLocationId: req.retellContext.squareLocationId,
        squareEnvironment: req.retellContext.squareEnvironment || 'production',
        timezone: req.retellContext.timezone || 'America/New_York',
        businessName: req.retellContext.businessName || 'Elite Barbershop',
        squareMerchantId: req.retellContext.squareMerchantId,
        supportsSellerLevelWrites: req.retellContext.supportsSellerLevelWrites === false ? false : true,
        squareRefreshToken: req.retellContext.squareRefreshToken,
        squareTokenExpiresAt: req.retellContext.squareTokenExpiresAt,
        squareScopes: req.retellContext.squareScopes,
        defaultLocationId: req.retellContext.defaultLocationId || req.retellContext.squareLocationId
      };

      logger.info('Tenant context created from agentAuth', {
        tenantId: req.tenant.id,
        correlationId: req.correlationId
      });
    } else {
      // Fallback to environment variables (development/single-tenant mode)
      req.tenant = {
        id: 'default',
        agentId: 'default',
        accessToken: config.square.accessToken,
        locationId: config.square.locationId,
        squareAccessToken: config.square.accessToken,
        squareLocationId: config.square.locationId,
        squareEnvironment: config.square.environment || 'sandbox',
        timezone: config.server.timezone || 'America/New_York',
        businessName: config.businessName || 'Elite Barbershop',
        supportsSellerLevelWrites: true,
        defaultLocationId: config.square.locationId
      };

      if (!req.path.includes('/health') && !req.path.includes('/warmup')) {
        logger.debug('Tenant context created from environment variables', {
          tenantId: req.tenant.id,
          correlationId: req.correlationId
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Failed to create tenant context', {
      error: error.message,
      correlationId: req.correlationId
    });

    // Don't fail the request - fall back to default tenant
    req.tenant = {
      id: 'fallback',
      squareAccessToken: config.square.accessToken,
      squareLocationId: config.square.locationId,
      squareEnvironment: config.square.environment || 'sandbox',
      timezone: config.server.timezone || 'America/New_York',
      businessName: config.businessName || 'Elite Barbershop'
    };

    next();
  }
}

module.exports = tenantContext;
