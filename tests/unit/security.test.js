// tests/security.test.js

const {
  rateLimit,
  getSecurityHeaders,
  sanitizeQueryParams,
  sanitizePhoneNumber,
  sanitizeInput,
  generateCorrelationId,
  clearRateLimitStore,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW
} = require('../../src/utils/security');

describe('Security Module', () => {
  let mockContext;
  let mockReq;

  beforeEach(() => {
    mockContext = {
      log: jest.fn()
    };

    mockReq = {
      headers: {}
    };

    // Clear the rate limit store before each test
    clearRateLimitStore();
  });

  describe('rateLimit', () => {
    test('should allow first request from IP', () => {
      mockReq.headers['x-forwarded-for'] = '192.168.1.1';

      const result = rateLimit(mockContext, mockReq);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);
    });

    test('should track multiple requests from same IP', () => {
      mockReq.headers['x-forwarded-for'] = '192.168.1.1';

      // First request
      let result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);

      // Second request
      result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 2);
    });

    test('should block requests when limit exceeded', () => {
      mockReq.headers['x-forwarded-for'] = '192.168.1.1';

      // Make maximum allowed requests
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        const result = rateLimit(mockContext, mockReq);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetTime).toBeGreaterThan(0);
      expect(result.message).toContain('Rate limit exceeded');
    });

    test('should handle different IP address sources', () => {
      // Test x-forwarded-for
      mockReq.headers['x-forwarded-for'] = '192.168.1.1';
      let result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(true);

      // Test x-real-ip
      delete mockReq.headers['x-forwarded-for'];
      mockReq.headers['x-real-ip'] = '192.168.1.2';
      result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(true);

      // Test x-client-ip
      delete mockReq.headers['x-real-ip'];
      mockReq.headers['x-client-ip'] = '192.168.1.3';
      result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(true);

      // Test unknown IP
      delete mockReq.headers['x-client-ip'];
      result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(true);
    });

    test('should reset window after time expires', () => {
      mockReq.headers['x-forwarded-for'] = '192.168.1.1';

      // Make requests to fill the limit
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        rateLimit(mockContext, mockReq);
      }

      // Should be blocked
      let result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(false);

      // Mock time passing by modifying Date.now
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + RATE_LIMIT_WINDOW + 1000);

      // Should be allowed again
      result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);

      // Restore Date.now
      Date.now = originalNow;
    });

    test('should handle multiple IPs independently', () => {
      mockReq.headers['x-forwarded-for'] = '192.168.1.1';
      const result1 = rateLimit(mockContext, mockReq);
      expect(result1.allowed).toBe(true);

      mockReq.headers['x-forwarded-for'] = '192.168.1.2';
      const result2 = rateLimit(mockContext, mockReq);
      expect(result2.allowed).toBe(true);

      // Both should have independent counters
      expect(result1.remaining).toBe(result2.remaining);
    });

    test('should clean up old entries to prevent memory leaks', () => {
      // This test verifies the cleanup logic triggers
      // Create many entries to trigger cleanup
      for (let i = 0; i < 10001; i++) {
        mockReq.headers['x-forwarded-for'] = `192.168.1.${i}`;
        rateLimit(mockContext, mockReq);
      }

      // Should still work after cleanup
      mockReq.headers['x-forwarded-for'] = '10.0.0.1';
      const result = rateLimit(mockContext, mockReq);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getSecurityHeaders', () => {
    test('should return all required security headers', () => {
      const headers = getSecurityHeaders();

      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(headers).toHaveProperty('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      expect(headers).toHaveProperty(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none';"
      );
      expect(headers).toHaveProperty('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(headers).toHaveProperty('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    });

    test('should return consistent headers on multiple calls', () => {
      const headers1 = getSecurityHeaders();
      const headers2 = getSecurityHeaders();

      expect(headers1).toEqual(headers2);
    });
  });

  describe('sanitizeQueryParams', () => {
    test('should remove script tags from string values', () => {
      const input = {
        service: 'SERVICE_1',
        malicious: '<script>alert("xss")</script>',
        barber: 'BARBER_1'
      };

      const result = sanitizeQueryParams(input);

      expect(result.service).toBe('SERVICE_1');
      expect(result.malicious).toBe('');
      expect(result.barber).toBe('BARBER_1');
    });

    test('should remove javascript: protocols', () => {
      const input = {
        redirect: 'javascript:alert("xss")',
        normal: 'normal_value'
      };

      const result = sanitizeQueryParams(input);

      expect(result.redirect).toBe('alert("xss")');
      expect(result.normal).toBe('normal_value');
    });

    test('should remove data: protocols', () => {
      const input = {
        image: 'data:text/html,some safe content here',
        normal: 'normal_value'
      };

      const result = sanitizeQueryParams(input);

      expect(result.image).toBe('some safe content here');
      expect(result.normal).toBe('normal_value');
    });

    test('should handle non-string values', () => {
      const input = {
        number: 123,
        array: ['item1', 'item2'],
        object: { key: 'value' },
        boolean: true,
        null: null,
        undefined
      };

      const result = sanitizeQueryParams(input);

      expect(result.number).toBe(123);
      expect(result.array).toEqual(['item1', 'item2']);
      expect(result.object).toEqual({ key: 'value' });
      expect(result.boolean).toBe(true);
      expect(result.null).toBe(null);
      expect(result.undefined).toBe(undefined);
    });

    test('should trim whitespace from string values', () => {
      const input = {
        service: '  SERVICE_1  ',
        barber: '\tBARBER_1\n'
      };

      const result = sanitizeQueryParams(input);

      expect(result.service).toBe('SERVICE_1');
      expect(result.barber).toBe('BARBER_1');
    });

    test('should handle empty object', () => {
      const result = sanitizeQueryParams({});
      expect(result).toEqual({});
    });

    test('should handle case-insensitive script removal', () => {
      const input = {
        test1: '<SCRIPT>alert("xss")</SCRIPT>',
        test2: '<Script>alert("xss")</Script>',
        test3: 'JAVASCRIPT:alert("xss")',
        test4: 'JavaScript:alert("xss")'
      };

      const result = sanitizeQueryParams(input);

      expect(result.test1).toBe('');
      expect(result.test2).toBe('');
      expect(result.test3).toBe('alert("xss")');
      expect(result.test4).toBe('alert("xss")');
    });
  });

  describe('sanitizePhoneNumber', () => {
    test('should preserve valid phone number characters', () => {
      const input = '+1 (555) 123-4567';
      const result = sanitizePhoneNumber(input);
      expect(result).toBe('+1 (555) 123-4567');
    });

    test('should remove XSS characters', () => {
      const input = '+1<script>alert("xss")</script>(555)123-4567';
      const result = sanitizePhoneNumber(input);
      expect(result).toBe('+1(555)123-4567');
    });

    test('should remove invalid characters but keep valid ones', () => {
      const input = '+1@#$%^&*(555)abc123def-4567';
      const result = sanitizePhoneNumber(input);
      expect(result).toBe('+1(555)123-4567');
    });

    test('should handle non-string input', () => {
      expect(sanitizePhoneNumber(123)).toBe('');
      expect(sanitizePhoneNumber(null)).toBe('');
      expect(sanitizePhoneNumber(undefined)).toBe('');
      expect(sanitizePhoneNumber({})).toBe('');
    });

    test('should trim whitespace', () => {
      const input = '  +1 (555) 123-4567  ';
      const result = sanitizePhoneNumber(input);
      expect(result).toBe('+1 (555) 123-4567');
    });

    test('should handle international formats', () => {
      const input = '+44.20.7946.0958';
      const result = sanitizePhoneNumber(input);
      expect(result).toBe('+44.20.7946.0958');
    });

    test('should handle empty string', () => {
      const result = sanitizePhoneNumber('');
      expect(result).toBe('');
    });
  });

  describe('sanitizeInput', () => {
    test('should remove XSS characters', () => {
      const input = 'Hello<script>alert("xss")</script>World';
      const result = sanitizeInput(input);
      expect(result).toBe('HelloscriptalertxssscriptWorld');
    });

    test('should remove common XSS characters', () => {
      const input = 'Test<>"\'&data';
      const result = sanitizeInput(input);
      expect(result).toBe('Testdata');
    });

    test('should remove null bytes and control characters', () => {
      const input = 'Hello\x00\x01\x1f\x7fWorld';
      const result = sanitizeInput(input);
      expect(result).toBe('HelloWorld');
    });

    test('should preserve valid characters', () => {
      const input = 'Hello World! 123 @#$%^*()_+-=[]{}|;:,.<>?/`~';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello World! 123 @#$%^*()_+-=[]{}|;:,.?/`~');
    });

    test('should handle non-string input', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
      expect(sanitizeInput({})).toEqual({});
      expect(sanitizeInput([])).toEqual([]);
    });

    test('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello World');
    });

    test('should handle empty string', () => {
      const result = sanitizeInput('');
      expect(result).toBe('');
    });

    test('should handle string with only control characters', () => {
      const input = '\x00\x01\x1f\x7f';
      const result = sanitizeInput(input);
      expect(result).toBe('');
    });

    test('should preserve unicode characters', () => {
      const input = 'Hello 世界 🌍 café';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello 世界 🌍 café');
    });
  });

  describe('generateCorrelationId', () => {
    test('should generate valid UUID', () => {
      const id = generateCorrelationId();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    test('should generate unique IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      const id3 = generateCorrelationId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    test('should generate consistent format across calls', () => {
      const ids = Array.from({ length: 100 }, () => generateCorrelationId());

      ids.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id.length).toBe(36); // UUID length with dashes
        expect(id.split('-')).toHaveLength(5); // UUID has 4 dashes
      });
    });
  });

  describe('Constants', () => {
    test('should export rate limit constants', () => {
      expect(typeof RATE_LIMIT_MAX_REQUESTS).toBe('number');
      expect(typeof RATE_LIMIT_WINDOW).toBe('number');
      expect(RATE_LIMIT_MAX_REQUESTS).toBeGreaterThan(0);
      expect(RATE_LIMIT_WINDOW).toBeGreaterThan(0);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete request sanitization flow', () => {
      const unsafeParams = {
        service: '<script>alert("xss")</script>SERVICE_1',
        barber: 'javascript:alert("xss")BARBER_1',
        phone: '+1<>"(555)123&4567',
        name: 'John\x00\x01Doe'
      };

      const sanitizedParams = sanitizeQueryParams(unsafeParams);
      const sanitizedPhone = sanitizePhoneNumber(unsafeParams.phone);
      const sanitizedName = sanitizeInput(unsafeParams.name);

      expect(sanitizedParams.service).toBe('SERVICE_1');
      expect(sanitizedParams.barber).toBe('alert("xss")BARBER_1');
      expect(sanitizedPhone).toBe('+1(555)1234567');
      expect(sanitizedName).toBe('JohnDoe');
    });

    test('should handle rate limiting for multiple IPs concurrently', () => {
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];

      ips.forEach(ip => {
        mockReq.headers['x-forwarded-for'] = ip;
        for (let i = 0; i < 50; i++) {
          const result = rateLimit(mockContext, mockReq);
          expect(result.allowed).toBe(true);
        }
      });

      // Each IP should still be within limits
      ips.forEach(ip => {
        mockReq.headers['x-forwarded-for'] = ip;
        const result = rateLimit(mockContext, mockReq);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 51);
      });
    });
  });
});
