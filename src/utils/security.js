// shared/security.js
const crypto = require('crypto');
const config = require('./config');

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
  getSecurityHeaders,
  sanitizeInput,
  generateCorrelationId
};
