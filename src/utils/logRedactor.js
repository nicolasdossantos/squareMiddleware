/**
 * Log Redaction Utility
 *
 * Provides functions to redact sensitive data from logs before they are written.
 * This prevents PII (Personally Identifiable Information), API keys, tokens,
 * and other sensitive data from being exposed in logs.
 *
 * Sensitive data types handled:
 * - Access tokens (Square, Retell, Bearer)
 * - Refresh tokens
 * - API keys
 * - Phone numbers (PII)
 * - Email addresses
 * - Customer IDs
 * - Merchant/Location IDs
 * - Request/Response bodies
 * - Webhook payloads
 */

const SENSITIVE_PATTERNS = {
  // Tokens and API keys
  accessToken: /^sq[a-z0-9_-]{100,}/i,
  bearerToken: /^[A-Za-z0-9\-._~+/]+=*$/,  // Generic bearer token format
  refreshToken: /^[a-z0-9_-]{50,}/i,
  apiKey: /^[a-z0-9_-]{32,}/i,
  retellApiKey: /^[a-z0-9_-]{40,}/i,

  // Patterns for common token/key formats
  jwToken: /^ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,

  // Phone numbers (multiple formats)
  phoneNumber: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/,

  // Email addresses
  emailAddress: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
};

/**
 * Redacts a single sensitive value
 * @param {string} value - The value to redact
 * @param {string} type - The type of sensitive data (e.g., 'token', 'phone', 'email')
 * @returns {string} The redacted value
 */
function redactValue(value, type = 'token') {
  if (!value || typeof value !== 'string') return value;

  const valueLength = value.length;

  switch (type) {
    case 'token':
    case 'accessToken':
    case 'refreshToken':
    case 'apiKey':
    case 'access_token':
    case 'refresh_token':
    case 'api_key':
    case 'squareAccessToken':
    case 'squareRefreshToken':
    case 'retellApiKey':
    case 'retell_api_key':
    case 'squareToken':
    case 'square_token':
    case 'authorization':
    case 'password':
      // Show first 6 and last 4 characters with [REDACTED] in middle
      if (valueLength <= 10) return '[REDACTED_TOKEN]';
      return `${value.substring(0, 6)}...[REDACTED]...${value.substring(valueLength - 4)}`;

    case 'phone':
    case 'phoneNumber':
    case 'phone_number':
      // Show last 4 digits: XXX-XXX-1234
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length >= 4) {
        return `XXX-XXX-${cleaned.slice(-4)}`;
      }
      return '[REDACTED_PHONE]';

    case 'email':
    case 'emailAddress':
    case 'email_address':
    case 'staffEmail':
    case 'staff_email':
      // Show domain only: ****@example.com
      const emailParts = value.split('@');
      if (emailParts.length === 2) {
        return `****@${emailParts[1]}`;
      }
      return '[REDACTED_EMAIL]';

    case 'customerId':
    case 'customer_id':
    case 'merchantId':
    case 'merchant_id':
    case 'locationId':
    case 'location_id':
    case 'agentId':
    case 'agent_id':
    case 'squareMerchantId':
    case 'square_merchant_id':
    case 'squareLocationId':
    case 'square_location_id':
      // These are IDs - redact completely to prevent correlation
      return '[REDACTED_ID]';

    default:
      return '[REDACTED]';
  }
}

/**
 * Detects if a value looks like a sensitive value based on patterns
 * @param {string} value - The value to check
 * @returns {string|null} The detected type ('token', 'phone', 'email', etc.) or null
 */
function detectSensitiveType(value) {
  if (!value || typeof value !== 'string') return null;

  // Check against known patterns
  if (SENSITIVE_PATTERNS.jwToken.test(value)) return 'token';
  if (SENSITIVE_PATTERNS.accessToken.test(value)) return 'accessToken';
  if (SENSITIVE_PATTERNS.refreshToken.test(value)) return 'refreshToken';
  if (SENSITIVE_PATTERNS.apiKey.test(value)) return 'apiKey';
  if (SENSITIVE_PATTERNS.phoneNumber.test(value)) return 'phone';
  if (SENSITIVE_PATTERNS.emailAddress.test(value)) return 'email';

  return null;
}

/**
 * List of known sensitive field names that should be redacted
 */
const SENSITIVE_FIELD_NAMES = new Set([
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'token',
  'authorization',
  'password',
  'phoneNumber',
  'phone_number',
  'phone',
  'email',
  'emailAddress',
  'email_address',
  'squareAccessToken',
  'squareRefreshToken',
  'squareMerchantId',
  'customerId',
  'customer_id',
  'merchantId',
  'merchant_id',
  'locationId',
  'location_id',
  'agentId',
  'agent_id',
  'retellApiKey',
  'retell_api_key',
  'squareToken',
  'square_token',
  'staffEmail',
  'staff_email',
  'squareLocationId',
  'square_location_id',
  'squareMerchantId',
  'square_merchant_id',
]);

/**
 * Redacts sensitive data from an object recursively
 * @param {*} obj - The object to redact
 * @param {Set} fieldsToRedact - Set of field names to redact (default: SENSITIVE_FIELD_NAMES)
 * @param {number} depth - Current recursion depth (to prevent infinite loops)
 * @returns {*} A copy of the object with sensitive fields redacted
 */
function redactObject(obj, fieldsToRedact = SENSITIVE_FIELD_NAMES, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) return obj;

  // Handle null/undefined
  if (obj === null || obj === undefined) return obj;

  // Handle primitives
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      // Check if value matches known sensitive patterns
      const detectedType = detectSensitiveType(obj);
      if (detectedType) {
        return redactValue(obj, detectedType);
      }
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, fieldsToRedact, depth + 1));
  }

  // Handle objects
  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (fieldsToRedact.has(key)) {
      // Field name is in the sensitive list - redact the value
      if (typeof value === 'string') {
        redacted[key] = redactValue(value, key);
      } else if (typeof value === 'object' && value !== null) {
        // For object values (like nested credentials), redact recursively
        redacted[key] = redactObject(value, fieldsToRedact, depth + 1);
      } else {
        redacted[key] = value;
      }
    } else {
      // Field is not in sensitive list, but recurse if it's an object
      if (typeof value === 'object' && value !== null) {
        redacted[key] = redactObject(value, fieldsToRedact, depth + 1);
      } else {
        redacted[key] = value;
      }
    }
  }

  return redacted;
}

/**
 * Redacts sensitive data from a string representation of an object
 * @param {string} jsonString - JSON string to redact
 * @returns {string} Redacted JSON string
 */
function redactJsonString(jsonString) {
  try {
    const obj = JSON.parse(jsonString);
    const redacted = redactObject(obj);
    return JSON.stringify(redacted);
  } catch {
    // If not valid JSON, return as-is
    return jsonString;
  }
}

/**
 * Redacts the body of a request or response payload
 * Used for logging full payloads while protecting sensitive data
 * @param {*} body - Request/response body
 * @returns {*} Redacted body
 */
function redactPayload(body) {
  return redactObject(body);
}

/**
 * Redacts metadata from webhook payloads
 * Allows logging event type and basic structure while protecting sensitive call data
 * @param {*} webhookPayload - Full webhook payload
 * @returns {Object} Webhook payload with sensitive fields redacted
 */
function redactWebhookPayload(webhookPayload) {
  if (!webhookPayload || typeof webhookPayload !== 'object') {
    return webhookPayload;
  }

  const redacted = {
    event: webhookPayload.event,
    data: webhookPayload.data ? redactObject(webhookPayload.data) : undefined,
  };

  return redacted;
}

/**
 * Creates a safe version of a request object for logging
 * @param {*} req - Express request object
 * @returns {Object} Safe request info for logging
 */
function redactRequest(req) {
  return {
    method: req.method,
    path: req.path,
    ip: req.ip,
    correlationId: req.correlationId,
    // Redact any request headers with sensitive data
    headers: redactObject({
      authorization: req.headers.authorization,
      'x-api-key': req.headers['x-api-key'],
      'x-retell-signature': req.headers['x-retell-signature'],
    }),
  };
}

/**
 * Middleware for express.json() to capture raw body for later use
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Buffer} buf - Raw body buffer
 */
function captureRawBody(req, res, buf) {
  if (buf && buf.length) {
    req.rawBody = buf;
  }
}

module.exports = {
  redactValue,
  redactObject,
  redactJsonString,
  redactPayload,
  redactWebhookPayload,
  redactRequest,
  detectSensitiveType,
  captureRawBody,
  SENSITIVE_FIELD_NAMES,
};
