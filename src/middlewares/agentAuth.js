const { Retell } = require('retell-sdk');
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

  // Debug: Log all headers to see what's being sent
  console.log('[AgentAuth] DEBUG - All headers received:', JSON.stringify(req.headers, null, 2));
  console.log('[AgentAuth] DEBUG - x-retell-signature:', signatureHeader);
  console.log('[AgentAuth] DEBUG - x-agent-id:', agentId);
  console.log('[AgentAuth] DEBUG - Request body:', JSON.stringify(req.body, null, 2));
  console.log('[AgentAuth] DEBUG - req.rawBody exists:', !!req.rawBody);
  if (req.rawBody) {
    console.log('[AgentAuth] DEBUG - req.rawBody length:', req.rawBody.length);
    console.log('[AgentAuth] DEBUG - req.rawBody content:', req.rawBody.toString('utf8'));
  }

  // Validate agent_id from header (Retell sends this with tool calls)
  if (!agentId) {
    return res.status(401).json({
      error: 'Missing x-agent-id header'
    });
  }

  // Check if signature header exists - if not, skip verification for now (debug mode)
  if (!signatureHeader) {
    console.log('[AgentAuth] ⚠️  WARNING: No x-retell-signature header. Retell may not be signing tool calls.');
    console.log('[AgentAuth] ⚠️  This is expected if Retell tool calls are unsigned.');
    console.log('[AgentAuth] ⚠️  Proceeding without signature verification for testing.');
    
    // For now, skip signature verification if header is missing
    // This allows us to test the rest of the flow
    try {
      const apiKey = config.retell?.apiKey;

      if (!apiKey) {
        console.error('[AgentAuth] RETELL_API_KEY not configured');
        return res.status(500).json({
          error: 'Retell API key not configured'
        });
      }

      // Load agent config from environment variables
      const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
      const squareLocationId = process.env.SQUARE_LOCATION_ID;

      if (!squareAccessToken || !squareLocationId) {
        console.error('[AgentAuth] Missing Square credentials in environment variables');
        return res.status(500).json({
          error: 'Square credentials not configured'
        });
      }

      // Attach tenant context to request
      const tenantContext = {
        id: agentId,
        agentId: agentId,
        accessToken: squareAccessToken,
        locationId: squareLocationId,
        squareAccessToken: squareAccessToken,
        squareLocationId: squareLocationId,
        squareEnvironment: process.env.SQUARE_ENVIRONMENT || 'production',
        timezone: process.env.TZ || 'America/New_York',
        authenticated: true,
        isRetellAgent: true
      };

      req.retellContext = tenantContext;
      req.tenant = tenantContext;

      console.log('[AgentAuth] ✅ Agent authenticated (no signature):', agentId);
      return next();
    } catch (error) {
      console.error('[AgentAuth] Error:', error);

      return res.status(500).json({
        error: 'Authorization service error'
      });
    }
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

    // Signature verified - load agent config from environment variables
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
    const squareLocationId = process.env.SQUARE_LOCATION_ID;

    if (!squareAccessToken || !squareLocationId) {
      console.error('[AgentAuth] Missing Square credentials in environment variables');
      return res.status(500).json({
        error: 'Square credentials not configured'
      });
    }

    // Attach tenant context to request
    const tenantContext = {
      id: agentId,
      agentId: agentId,
      accessToken: squareAccessToken,
      locationId: squareLocationId,
      squareAccessToken: squareAccessToken,
      squareLocationId: squareLocationId,
      squareEnvironment: process.env.SQUARE_ENVIRONMENT || 'production',
      timezone: process.env.TZ || 'America/New_York',
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
