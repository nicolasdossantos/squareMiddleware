const crypto = require('crypto');
const keyVaultService = require('../services/keyVaultService');

/**
 * Retell Signature Verification Middleware
 *
 * Verifies webhook signatures from Retell AI using HMAC-SHA256.
 *
 * Security features:
 * - Cryptographic signature verification
 * - Replay attack prevention (5-minute timestamp window)
 * - Timing-safe signature comparison
 *
 * Required headers:
 * - x-retell-signature: HMAC-SHA256 signature
 * - x-retell-timestamp: Unix timestamp
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function retellAuthMiddleware(req, res, next) {
  const signature = req.headers['x-retell-signature'];
  const timestamp = req.headers['x-retell-timestamp'];

  // 1. Check required headers
  if (!signature) {
    return res.status(401).json({
      error: 'Missing x-retell-signature header'
    });
  }

  if (!timestamp) {
    return res.status(401).json({
      error: 'Missing x-retell-timestamp header'
    });
  }

  // 2. Prevent replay attacks (5-minute window)
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(currentTime - requestTime);

  if (timeDiff > 300) {
    // 5 minutes
    return res.status(401).json({
      error: 'Request timestamp too old (possible replay attack)'
    });
  }

  try {
    // 3. Fetch Retell API key from Key Vault
    const apiKey = await keyVaultService.getRetellApiKey();

    // 4. Compute expected signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', apiKey).update(`${timestamp}.${payload}`).digest('hex');

    // 5. Compare signatures (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    // Signature valid - proceed to next middleware
    next();
  } catch (error) {
    console.error('[RetellAuth] Error:', error);
    return res.status(500).json({
      error: 'Authentication service error'
    });
  }
}

module.exports = retellAuthMiddleware;
