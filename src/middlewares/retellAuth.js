const crypto = require('crypto');
const config = require('../config');

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
 * - x-retell-signature: Format "v=<timestamp>,d=<signature>"
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function retellAuthMiddleware(req, res, next) {
  const signatureHeader = req.headers['x-retell-signature'];

  // 1. Check required header
  if (!signatureHeader) {
    console.warn('[RetellAuth] Missing x-retell-signature header');
    return res.status(401).json({
      error: 'Missing x-retell-signature header'
    });
  }

  try {
    // 2. Parse signature header: "v=<timestamp>,d=<signature>"
    const parts = signatureHeader.split(',');
    if (parts.length !== 2) {
      console.warn('[RetellAuth] Invalid signature format:', signatureHeader);
      return res.status(401).json({
        error: 'Invalid signature format'
      });
    }

    const timestamp = parts[0].split('=')[1];
    const signature = parts[1].split('=')[1];

    if (!timestamp || !signature) {
      console.warn('[RetellAuth] Missing timestamp or signature in header');
      return res.status(401).json({
        error: 'Invalid signature header'
      });
    }

    // 3. Prevent replay attacks (5-minute window)
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime);

    if (timeDiff > 300000) {
      // 5 minutes in milliseconds
      console.warn('[RetellAuth] Request timestamp too old:', { requestTime, currentTime, timeDiff });
      return res.status(401).json({
        error: 'Request timestamp too old (possible replay attack)'
      });
    }

    // 4. Get Retell API key from environment
    const apiKey = config.retell.apiKey;

    if (!apiKey) {
      console.error('[RetellAuth] RETELL_API_KEY not configured');
      return res.status(500).json({
        error: 'Retell API key not configured'
      });
    }

    // 5. Compute expected signature
    // Retell signature: HMAC-SHA256(timestamp + "." + body, api_key)
    const payload = JSON.stringify(req.body);
    const signaturePayload = `${timestamp}.${payload}`;

    const expectedSignature = crypto
      .createHmac('sha256', apiKey)
      .update(signaturePayload)
      .digest('hex');

    // 6. Compare signatures (timing-safe comparison)
    if (signature.length !== expectedSignature.length) {
      console.warn('[RetellAuth] Signature length mismatch');
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValid) {
      console.warn('[RetellAuth] Signature verification failed');
      console.debug('[RetellAuth] Expected:', expectedSignature);
      console.debug('[RetellAuth] Received:', signature);
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    console.log('[RetellAuth] ✅ Signature verified successfully');
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
