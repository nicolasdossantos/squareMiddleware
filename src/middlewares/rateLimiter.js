const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter Middleware
 *
 * Protects against abuse with rate limiting:
 * - 100 requests per 15 minutes per agent
 * - Uses in-memory store (FREE - no Redis needed)
 * - Health endpoints are excluded from rate limiting
 *
 * Returns 429 Too Many Requests when limit exceeded.
 */
const agentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per window per agent

  // Use agent ID as key (from x-agent-id header), fallback to IP
  keyGenerator: req => {
    const agentId = req.headers['x-agent-id'];
    return agentId || req.ip || 'unknown';
  },

  // Custom response
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Try again later.',
      retryAfter: req.rateLimit.resetTime
    });
  },

  // Skip successful requests to health endpoints
  skip: req => {
    return req.path.startsWith('/health');
  },

  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false
});

module.exports = agentRateLimiter;
