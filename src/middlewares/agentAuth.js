const { Retell } = require('retell-sdk');
const keyVaultService = require('../services/keyVaultService');
const { config } = require('../config');

/**
 * Per-Agent Authorization Middleware
 *
 * Validates Retell agent tool call signatures and loads tenant context.
 *
 * For Retell agents:
 * - Verifies x-retell-signature using RETELL_API_KEY
 * - Extracts agent_id from x-agent-id header (Retell provides this with tool calls)
 * - Loads agent config from Key Vault to get Square credentials
 *
 * On success, attaches req.retellContext and req.tenant with:
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
  const signatureHeader = req.headers['x-retell-signature'];
  const agentId = req.headers['x-agent-id'];

  // Validate signature header exists
  if (!signatureHeader) {
    return res.status(401).json({
      error: 'Missing x-retell-signature header'
    });
  }

  // Validate agent_id from header (Retell sends this with tool calls)
  if (!agentId) {
    return res.status(401).json({
      error: 'Missing x-agent-id header'
    });
  }

  try {
    const apiKey = config.retell?.apiKey;

    if (!apiKey) {
      console.error('[AgentAuth] RETELL_API_KEY not configured');
      return res.status(500).json({
        error: 'Retell API key not configured'
      });
    }

    // Verify Retell signature
    // Use raw body if available (set by body parser middleware), otherwise JSON stringify
    const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

    const isValid = Retell.verify(payload, apiKey, signatureHeader);

    if (!isValid) {
      console.warn('[AgentAuth] Signature verification failed for agent:', agentId);
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    // Signature verified - load agent config from Key Vault
    const agentConfig = await keyVaultService.getAgentConfig(agentId);

    // Attach tenant context to request
    const tenantContext = {
      id: agentId,
      agentId: agentId,
      accessToken: agentConfig.squareAccessToken,
      locationId: agentConfig.squareLocationId,
      squareAccessToken: agentConfig.squareAccessToken,
      squareLocationId: agentConfig.squareLocationId,
      squareEnvironment: agentConfig.squareEnvironment || 'production',
      timezone: agentConfig.timezone || 'America/New_York',
      authenticated: true,
      isRetellAgent: true
    };

    req.retellContext = tenantContext;
    req.tenant = tenantContext;

    console.log('[AgentAuth] ✅ Agent authenticated:', agentId);
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
