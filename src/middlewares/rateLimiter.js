const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter Middleware
 *
 * Protects against abuse with per-tenant rate limiting:
 * - 100 requests per 15 minutes per tenant
 * - Uses in-memory store (FREE - no Redis needed)
 * - Health endpoints are excluded from rate limiting
 * - Tenant isolation prevents noisy neighbor problems
 *
 * Returns 429 Too Many Requests when limit exceeded.
 */
const agentRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // Max 100 requests per window per tenant

  // Per-tenant rate limiting: Use tenant ID, agent ID, or fallback to IP
  keyGenerator: req => {
    // Priority 1: Tenant ID from tenant context (most accurate)
    if (req.tenant?.id) {
      return `tenant:${req.tenant.id}`;
    }

    // Priority 2: Agent ID from Retell context
    if (req.retellContext?.agentId) {
      return `agent:${req.retellContext.agentId}`;
    }

    // Priority 3: Agent ID header
    const agentId = req.headers['x-agent-id'];
    if (agentId) {
      return `agent:${agentId}`;
    }

    // Fallback: IP address (shared rate limit for unauthenticated requests)
    return `ip:${req.ip || 'unknown'}`;
  },

  // Custom response with tenant info
  handler: (req, res) => {
    const tenantId = req.tenant?.id || req.retellContext?.agentId || 'unknown';

    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded for tenant ${tenantId}. Try again later.`,
      tenant: tenantId,
      limit: req.rateLimit.limit,
      current: req.rateLimit.current,
      remaining: req.rateLimit.remaining,
      resetTime: new Date(req.rateLimit.resetTime).toISOString()
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
