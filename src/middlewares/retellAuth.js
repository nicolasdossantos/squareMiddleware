const { Retell } = require('retell-sdk');
const { config } = require('../config');

/**
 * Retell Signature Verification Middleware
 *
 * Uses the official Retell SDK to validate webhook signatures. The SDK handles
 * canonical payload formatting and signature construction, preventing subtle
 * mismatches between server and client implementations.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function retellAuthMiddleware(req, res, next) {
  const signatureHeader = req.headers['x-retell-signature'];

  if (!signatureHeader) {
    console.warn('[RetellAuth] Missing x-retell-signature header');
    return res.status(401).json({ error: 'Missing x-retell-signature header' });
  }

  try {
    const apiKey = config.retell?.apiKey;

    if (!apiKey) {
      console.error('[RetellAuth] RETELL_API_KEY not configured');
      return res.status(500).json({ error: 'Retell API key not configured' });
    }

    // Retell requires the raw request payload for verification to ensure the
    // exact bytes sent by their servers are used when generating the HMAC.
    const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

    const isValid = Retell.verify(payload, apiKey, signatureHeader);

    if (!isValid) {
      console.warn('[RetellAuth] Signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('[RetellAuth] ✅ Signature verified successfully');
    next();
  } catch (error) {
    console.error('[RetellAuth] Error during signature verification:', error);
    return res.status(500).json({ error: 'Authentication service error' });
  }
}

module.exports = retellAuthMiddleware;
