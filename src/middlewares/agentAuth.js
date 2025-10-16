const agentConfigService = require('../services/agentConfigService');

/**
 * Per-Agent Authorization Middleware
 *
 * Validates agent Bearer token and loads Square credentials from App Settings.
 *
 * Required headers:
 * - Authorization: Bearer <agent-token>
 * - x-agent-id: <agent-id>
 *
 * On success, attaches req.retellContext with:
 * - agentId: Agent identifier
 * - squareAccessToken: Square API access token
 * - squareLocationId: Square location ID
 * - squareApplicationId: Square application ID
 * - squareEnvironment: Square environment (sandbox/production)
 * - timezone: Business timezone
 * - staffEmail: Staff email for notifications
 * - businessName: Business name
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function agentAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const agentId = req.headers['x-agent-id'];

  console.log('[AgentAuth] Middleware called', { authHeader: !!authHeader, agentId });

  // 1. Check required headers
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AgentAuth] Missing or invalid Authorization header');
    return res.status(401).json({
      error: 'Missing or invalid Authorization header'
    });
  }

  if (!agentId) {
    console.log('[AgentAuth] Missing x-agent-id header');
    return res.status(401).json({
      error: 'Missing x-agent-id header'
    });
  }

  const bearerToken = authHeader.substring(7); // Remove "Bearer "
  console.log('[AgentAuth] Validating token for agent:', agentId);

  try {
    // 2. Get agent config
    const agentConfig = agentConfigService.getAgentConfig(agentId);

    if (!agentConfig) {
      console.log('[AgentAuth] Agent not found');
      return res.status(404).json({
        error: `Agent ${agentId} not found`
      });
    }

    // 3. Validate bearer token
    if (agentConfig.bearerToken !== bearerToken) {
      console.log('[AgentAuth] Invalid bearer token');
      return res.status(403).json({
        error: 'Invalid bearer token for agent'
      });
    }

    console.log('[AgentAuth] Auth successful, setting tenant:', agentConfig.agentId);

    // 3. Attach Retell context to request (replaces old tenantContext)
    req.retellContext = {
      agentId: agentConfig.agentId,
      squareAccessToken: agentConfig.squareAccessToken,
      squareLocationId: agentConfig.squareLocationId,
      squareApplicationId: agentConfig.squareApplicationId,
      squareEnvironment: agentConfig.squareEnvironment,
      timezone: agentConfig.timezone,
      staffEmail: agentConfig.staffEmail,
      businessName: agentConfig.businessName
    };

    // 4. Override tenant context with agent-specific credentials
    // (tenantContext middleware may have set defaults from env vars)
    req.tenant = {
      id: agentConfig.agentId,
      accessToken: agentConfig.squareAccessToken, // Note: squareUtils expects 'accessToken'
      locationId: agentConfig.squareLocationId, // Note: squareUtils expects 'locationId'
      squareAccessToken: agentConfig.squareAccessToken, // Keep for compatibility
      squareLocationId: agentConfig.squareLocationId, // Keep for compatibility
      squareApplicationId: agentConfig.squareApplicationId,
      squareEnvironment: agentConfig.squareEnvironment,
      timezone: agentConfig.timezone,
      staffEmail: agentConfig.staffEmail,
      businessName: agentConfig.businessName
    };

    // Authorization successful - proceed
    next();
  } catch (error) {
    console.error('[AgentAuth] Error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: `Agent ${agentId} not found`
      });
    }

    return res.status(500).json({
      error: 'Authorization service error'
    });
  }
}

module.exports = agentAuthMiddleware;
