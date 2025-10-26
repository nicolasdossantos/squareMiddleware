const { getSecurityHeaders, sanitizeInput, generateCorrelationId } = require('../../src/utils/security');

describe('Security Utilities', () => {
  describe('getSecurityHeaders', () => {
    test('returns expected security headers', () => {
      const headers = getSecurityHeaders();

      expect(headers).toMatchObject({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      });
    });

    test('returns deterministic output', () => {
      const first = getSecurityHeaders();
      const second = getSecurityHeaders();

      expect(second).toEqual(first);
    });
  });

  describe('sanitizeInput', () => {
    test('strips XSS vectors aggressively when needed', () => {
      const input = 'Hello<script>alert("xss")</script>(world)';
      expect(sanitizeInput(input)).toBe('Helloscriptalertxssscriptworld');
    });

    test('removes common HTML special characters', () => {
      const input = '"quoted"<value>\'ampersand&';
      expect(sanitizeInput(input)).toBe('quotedvalueampersand');
    });

    test('filters control characters while keeping printable text', () => {
      const input = 'alpha\x00\x01\x02beta';
      expect(sanitizeInput(input)).toBe('alphabeta');
    });

    test('returns non-strings untouched', () => {
      expect(sanitizeInput(42)).toBe(42);
      expect(sanitizeInput(null)).toBeNull();
      const obj = { ok: true };
      expect(sanitizeInput(obj)).toBe(obj);
    });
  });

  describe('generateCorrelationId', () => {
    test('returns a UUID v4 string', () => {
      const id = generateCorrelationId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    test('produces unique values', () => {
      const ids = new Set();
      for (let i = 0; i < 5; i += 1) {
        ids.add(generateCorrelationId());
      }
      expect(ids.size).toBe(5);
    });
  });
});
