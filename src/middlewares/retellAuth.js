const { Retell } = require('retell-sdk');
const { config } = require('../config');

/**
 * Retell Signature Verification Middleware
 *
 * Verifies webhook signatures from Retell AI using the official Retell SDK.
 *
 * Security features:
 * - Cryptographic signature verification (HMAC-SHA256)
 * - Replay attack prevention (5-minute timestamp window)
 * - Timing-safe signature comparison
 *
 * Required headers:
 * - x-retell-signature: Format "v=<timestamp>,d=<signature>"
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function retellAuthMiddleware(req, res, next) {
  const signature = req.headers['x-retell-signature'];

  // 1. Check required header
  if (!signature) {
    console.warn('[RetellAuth] Missing x-retell-signature header');
    return res.status(401).json({
      error: 'Missing x-retell-signature header'
    });
  }

  try {
    // 2. Get Retell API key from configuration
    const apiKey = config.retell?.apiKey;

    if (!apiKey) {
      console.error('[RetellAuth] RETELL_API_KEY not configured');
      return res.status(500).json({
        error: 'Retell API key not configured'
      });
    }

    // 3. Get raw request body (required for signature verification)
    const body = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

    // 4. Verify signature using official Retell SDK
    // This handles: timestamp validation, HMAC-SHA256 computation, timing-safe comparison
    const isValid = Retell.verify(body, apiKey, signature);

    if (!isValid) {
      console.warn('[RetellAuth] Signature verification failed');
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    console.log('[RetellAuth] ✅ Signature verified successfully');
    next();
  } catch (error) {
    console.error('[RetellAuth] Error during signature verification:', error);
    return res.status(500).json({
      error: 'Authentication service error'
    });
  }
}

module.exports = retellAuthMiddleware;
