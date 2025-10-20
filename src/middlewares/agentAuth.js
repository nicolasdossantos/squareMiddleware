const { Retell } = require('retell-sdk');
const { config } = require('../config');
const sessionStore = require('../services/sessionStore');

/**
 * Per-Agent Authorization Middleware
 *
 * Handles two authentication flows:
 *
 * 1. RETELL TOOL CALLS (with x-retell-call-id header):
 *    - Looks up session in sessionStore by call_id
 *    - Loads agent credentials from session
 *    - Verifies session not expired
 *
 * 2. WEBHOOK CALLS (with x-retell-signature header):
 *    - Verifies Retell signature
 *    - Passed to webhook handler which creates session
 *
 * 3. REGULAR REST CALLS (no Retell headers):
 *    - Uses default environment variable credentials
 *    - For backward compatibility or direct API access
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
  const callId = req.headers['x-retell-call-id'];
  const agentId = req.headers['x-agent-id'];

  console.log('[AgentAuth] DEBUG - Headers:', { signatureHeader: !!signatureHeader, callId, agentId });

  // FLOW 1: RETELL TOOL CALLS (from Retell agent during active call)
  // These have x-retell-call-id header - look up session
  if (callId) {
    if (signatureHeader) {
      console.log('[AgentAuth] ℹ️  Signature header present but prioritizing session-based auth');
    }

    console.log(`[AgentAuth] 🔍 Looking up session for call: ${callId}`);

    const session = sessionStore.getSession(callId);

    if (!session) {
      console.error(`[AgentAuth] ❌ Session not found or expired: ${callId}`);
      return res.status(401).json({
        error: 'Session expired or not found',
        callId
      });
    }

    // Attach tenant context from session
    const tenantContext = {
      id: session.agentId,
      agentId: session.agentId,
      callId: callId,
      accessToken: session.credentials.squareAccessToken,
      locationId: session.credentials.squareLocationId,
      squareAccessToken: session.credentials.squareAccessToken,
      squareLocationId: session.credentials.squareLocationId,
      squareEnvironment: session.credentials.squareEnvironment || 'production',
      timezone: session.credentials.timezone || 'America/New_York',
      authenticated: true,
      isRetellAgent: true,
      isToolCall: true
    };

    req.retellContext = tenantContext;
    req.tenant = tenantContext;

    console.log(`[AgentAuth] ✅ Agent authenticated from session: ${session.agentId}`);
    return next();
  }

  // FLOW 2: WEBHOOK CALLS (with Retell signature)
  // Verify signature - session creation happens in webhook handler
  if (signatureHeader) {
    console.log('[AgentAuth] 🔐 Verifying Retell webhook signature');

    try {
      const apiKey = config.retell?.apiKey;

      if (!apiKey) {
        console.error('[AgentAuth] RETELL_API_KEY not configured');
        return res.status(500).json({
          error: 'Retell API key not configured'
        });
      }

      // Verify Retell signature
      const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
      const isValid = Retell.verify(payload, apiKey, signatureHeader);

      if (!isValid) {
        console.warn('[AgentAuth] ❌ Signature verification failed');
        return res.status(401).json({
          error: 'Invalid signature'
        });
      }

      // Signature verified - webhook handler will create session
      console.log('[AgentAuth] ✅ Webhook signature verified');
      return next();
    } catch (error) {
      console.error('[AgentAuth] Error verifying signature:', error);
      return res.status(500).json({
        error: 'Signature verification error'
      });
    }
  }

  // FLOW 3: REGULAR REST CALLS (no Retell headers)
  // Use default environment credentials
  console.log('[AgentAuth] ℹ️  No Retell headers - treating as regular REST API call');

  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  const squareLocationId = process.env.SQUARE_LOCATION_ID;

  if (squareAccessToken && squareLocationId) {
    const tenantContext = {
      id: 'default',
      agentId: 'default',
      accessToken: squareAccessToken,
      locationId: squareLocationId,
      squareAccessToken: squareAccessToken,
      squareLocationId: squareLocationId,
      squareEnvironment: process.env.SQUARE_ENVIRONMENT || 'production',
      timezone: process.env.TZ || 'America/New_York',
      authenticated: true,
      isRetellAgent: false,
      isToolCall: false
    };

    req.retellContext = tenantContext;
    req.tenant = tenantContext;
  }

  return next();
}

module.exports = agentAuthMiddleware;
