// shared/security.js
const crypto = require('crypto');
const config = require('./config');

// Simple in-memory rate limiter
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

/**
 * Clear rate limit store (for testing)
 */
function clearRateLimitStore() {
  rateLimitStore.clear();
}

/**
 * Simple rate limiting middleware
 */
function rateLimit(context, req) {
  // Get client IP (in Azure Functions, check various headers)
  const clientIP =
    req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-client-ip'] || 'unknown';

  const now = Date.now();
  const key = `rate_limit:${clientIP}`;

  // Clean up old entries
  if (rateLimitStore.size > 10000) {
    // Prevent memory leaks
    for (const [k, v] of rateLimitStore.entries()) {
      if (now - v.firstRequest > RATE_LIMIT_WINDOW) {
        rateLimitStore.delete(k);
      }
    }
  }

  const record = rateLimitStore.get(key);

  if (!record) {
    // First request from this IP
    rateLimitStore.set(key, {
      count: 1,
      firstRequest: now,
      lastRequest: now
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  // Check if window has expired
  if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
    // Reset the window
    rateLimitStore.set(key, {
      count: 1,
      firstRequest: now,
      lastRequest: now
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  // Within the window, check count BEFORE incrementing
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetTime = Math.ceil((record.firstRequest + RATE_LIMIT_WINDOW - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      message: `Rate limit exceeded. Try again in ${resetTime} seconds.`
    };
  }

  // Increment counter
  record.count++;
  record.lastRequest = now;
  rateLimitStore.set(key, record);

  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

/**
 * Generate security headers with CORS support
 */
function getSecurityHeaders(origin = null) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };

  // Add CORS headers if enabled and origin is allowed
  if (config.ENABLE_CORS) {
    // Check if the origin is in our allowed list or if no origin is provided (same-origin)
    const isAllowedOrigin =
      !origin || config.CORS_ORIGINS.includes(origin) || config.CORS_ORIGINS.includes('*');

    if (isAllowedOrigin) {
      headers['Access-Control-Allow-Origin'] = origin || '*';
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers'] =
        'Content-Type, Authorization, X-Requested-With, X-Correlation-ID';
      headers['Access-Control-Max-Age'] = '86400'; // 24 hours
      headers['Access-Control-Allow-Credentials'] = 'false';
    }
  }

  return headers;
}

/**
 * Handle CORS preflight requests
 */
function handleCORSPreflight(origin) {
  if (!config.ENABLE_CORS) {
    return null;
  }

  const isAllowedOrigin =
    !origin || config.CORS_ORIGINS.includes(origin) || config.CORS_ORIGINS.includes('*');

  if (!isAllowedOrigin) {
    return {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      },
      jsonBody: {
        success: false,
        error: 'CORS origin not allowed'
      }
    };
  }

  return {
    status: 200,
    headers: {
      ...getSecurityHeaders(origin)
    }
  };
}

/**
 * Validate and sanitize query parameters
 */
function sanitizeQueryParams(params) {
  const sanitized = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      let cleaned = value;

      // Remove data: protocol prefix but keep the content
      cleaned = cleaned.replace(/^data:[^,]*,/, '');

      // Remove script tags and javascript: protocols
      cleaned = cleaned
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '');

      // Trim and keep non-empty result
      cleaned = cleaned.trim();

      sanitized[key] = cleaned;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize phone number input
 */
function sanitizePhoneNumber(phoneNumber) {
  if (typeof phoneNumber !== 'string') {
    return '';
  }

  // First remove dangerous characters but keep the content
  let sanitized = phoneNumber.replace(/[<>"'&]/g, '');

  // Remove script tags completely
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Normalize phone number format (keep only digits, +, -, (, ), spaces, and dots)
  sanitized = sanitized.replace(/[^\d+\-() .]/g, '');

  // Remove empty parentheses that might be left over
  sanitized = sanitized.replace(/\(\)/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * General input sanitization
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Check if input contains script-like patterns and apply more aggressive sanitization
  const hasScriptPattern = /script|alert|eval|onclick|onerror|onload/i.test(input);

  let sanitized;
  if (hasScriptPattern) {
    // Remove more characters when script patterns are detected
    sanitized = input.replace(/[<>"'&()/]/g, '');
  } else {
    // Standard sanitization for normal input
    sanitized = input.replace(/[<>"'&]/g, '');
  }

  // Remove null bytes and control characters using string filtering
  sanitized = sanitized
    .split('')
    .filter(char => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Generate request correlation ID for tracking
 */
function generateCorrelationId() {
  return crypto.randomUUID();
}

module.exports = {
  rateLimit,
  getSecurityHeaders,
  sanitizeQueryParams,
  sanitizePhoneNumber,
  sanitizeInput,
  generateCorrelationId,
  clearRateLimitStore,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW,
  handleCORSPreflight
};
