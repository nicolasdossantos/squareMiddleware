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
  const retellApiKey = req.headers['x-retell-api-key'];

  // 1. Allow Retell agent tool calls using RETELL_API_KEY
  // Retell cannot pass custom headers in tool definitions, so we use API key auth instead
  if (retellApiKey && retellApiKey === process.env.RETELL_API_KEY) {
    // Retell agent authenticated - use default agent context
    req.retellContext = {
      agentId: 'retell-agent',
      squareAccessToken: process.env.SQUARE_ACCESS_TOKEN,
      squareLocationId: process.env.SQUARE_LOCATION_ID,
      timezone: process.env.TZ || 'America/New_York',
      authenticated: true,
      isRetellAgent: true
    };
    return next();
  }

  // 2. Check required headers for standard Bearer token auth
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid Authorization header'
    });
  }

  if (!agentId) {
    return res.status(401).json({
      error: 'Missing x-agent-id header'
    });
  }

  const bearerToken = authHeader.substring(7); // Remove "Bearer "

  try {
    // 2. Fetch agent config from Key Vault
    const agentConfig = await keyVaultService.getAgentConfig(agentId);

    // 3. Validate Bearer token
    if (agentConfig.bearerToken !== bearerToken) {
      return res.status(403).json({
        error: 'Invalid bearer token for agent'
      });
    }

    // 4. Attach Retell context to request (replaces old tenantContext)
    req.retellContext = {
      agentId: agentConfig.agentId,
      squareAccessToken: agentConfig.squareAccessToken,
      squareLocationId: agentConfig.squareLocationId,
      squareEnvironment: agentConfig.squareEnvironment,
      timezone: agentConfig.timezone
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
