const keyVaultService = require('../services/keyVaultService');

/**
 * Per-Agent Authorization Middleware
 *
 * Validates agent Bearer token and loads Square credentials from Key Vault.
 *
 * Required headers:
 * - Authorization: Bearer <agent-token>
 * - x-agent-id: <agent-id>
 *
 * On success, attaches req.retellContext with:
 * - agentId: Agent identifier
 * - squareAccessToken: Square API access token
 * - squareLocationId: Square location ID
 * - squareEnvironment: Square environment (sandbox/production)
 * - timezone: Business timezone
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function agentAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const agentId = req.headers['x-agent-id'];

  // 1. Check for Bearer token (both Retell agent and standard auth use this now)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid Authorization header'
    });
  }

  const bearerToken = authHeader.substring(7); // Remove "Bearer "

  // 2. Try Retell agent authentication first (Bearer token === RETELL_API_KEY)
  if (bearerToken === process.env.RETELL_API_KEY) {
    // Retell agent authenticated securely via Bearer token
    // Set both req.retellContext and req.tenant for compatibility
    // ✅ SECURE: Uses standard Authorization header, API key not in custom headers
    const tenantContext = {
      id: 'retell-agent',
      agentId: 'retell-agent',
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      locationId: process.env.SQUARE_LOCATION_ID,
      squareAccessToken: process.env.SQUARE_ACCESS_TOKEN,
      squareLocationId: process.env.SQUARE_LOCATION_ID,
      timezone: process.env.TZ || 'America/New_York',
      environment: process.env.SQUARE_ENVIRONMENT || 'production',
      authenticated: true,
      isRetellAgent: true
    };
    req.retellContext = tenantContext;
    req.tenant = tenantContext;
    return next();
  }

  // 3. Try standard Key Vault agent authentication
  // For standard agents, also require x-agent-id header
  if (!agentId) {
    return res.status(401).json({
      error: 'Missing x-agent-id header'
    });
  }

  try {
    // Fetch agent config from Key Vault
    const agentConfig = await keyVaultService.getAgentConfig(agentId);

    // Validate Bearer token
    if (agentConfig.bearerToken !== bearerToken) {
      return res.status(403).json({
        error: 'Invalid bearer token for agent'
      });
    }

    // Attach context to request
    const tenantContext = {
      id: agentId,
      agentId: agentConfig.agentId,
      accessToken: agentConfig.squareAccessToken,
      locationId: agentConfig.squareLocationId,
      squareAccessToken: agentConfig.squareAccessToken,
      squareLocationId: agentConfig.squareLocationId,
      squareEnvironment: agentConfig.squareEnvironment,
      timezone: agentConfig.timezone
    };
    req.retellContext = tenantContext;
    req.tenant = tenantContext;

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
