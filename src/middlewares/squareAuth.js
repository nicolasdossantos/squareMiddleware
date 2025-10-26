const crypto = require('crypto');
const { config } = require('../config');
const { logger } = require('../utils/logger');

/**
 * Square Webhook Signature Verification Middleware
 *
 * Verifies that webhook payloads from Square are authentic using HMAC-SHA256
 * signature verification as documented by Square:
 * https://developer.squareup.com/docs/webhooks/validate
 *
 * Square includes the signature in the X-Square-HMAC-SHA256 header.
 * We compute HMAC-SHA256 of the raw request body using the webhook signature key
 * and compare it against the provided signature.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
async function squareAuthMiddleware(req, res, next) {
  const signatureHeader = req.headers['x-square-hmac-sha256'];

  if (!signatureHeader) {
    logger.warn('[SquareAuth] Missing X-Square-HMAC-SHA256 header');
    return res.status(401).json({
      error: 'Missing X-Square-HMAC-SHA256 header',
      message: 'Invalid webhook signature'
    });
  }

  try {
    const webhookSignatureKey = config.square?.webhookSignatureKey;

    if (!webhookSignatureKey) {
      logger.error('[SquareAuth] SQUARE_WEBHOOK_SIGNATURE_KEY not configured');
      return res.status(500).json({
        error: 'Webhook signature key not configured',
        message: 'Server configuration error'
      });
    }

    // Get raw body for signature verification
    // The express.json() middleware stores it in req.rawBody
    const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

    // Compute HMAC-SHA256 signature
    const computedSignature = crypto
      .createHmac('sha256', webhookSignatureKey)
      .update(payload)
      .digest('base64');

    // Compare signatures using constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(signatureHeader)
    );

    if (!isValid) {
      logger.warn('[SquareAuth] Signature verification failed', {
        path: req.path,
        ip: req.ip,
        provided: signatureHeader.substring(0, 10) + '...',
        computed: computedSignature.substring(0, 10) + '...'
      });
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Webhook signature verification failed'
      });
    }

    logger.info('[SquareAuth] ✅ Signature verified successfully');
    next();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('timingSafeEqual')) {
      // Signature lengths don't match - treat as invalid
      logger.warn('[SquareAuth] Signature length mismatch', {
        error: error.message
      });
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Webhook signature verification failed'
      });
    }

    logger.error('[SquareAuth] Error during signature verification:', error);
    return res.status(500).json({
      error: 'Signature verification error',
      message: 'Server error during authentication'
    });
  }
}

module.exports = squareAuthMiddleware;
