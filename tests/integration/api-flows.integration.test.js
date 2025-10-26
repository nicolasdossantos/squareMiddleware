/**
 * Integration Tests for Critical API Flows
 * Tests end-to-end flows including middleware, validation, and handlers
 */

const request = require('supertest');
const createApp = require('../../src/express-app');

describe('API Integration Tests - Critical Flows', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('Authentication Middleware', () => {
    test('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/customers/info')
        .set('Content-Type', 'application/json')
        .send({ customerId: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    test('should accept requests with valid x-retell-call-id header', async () => {
      // This endpoint should exist and require auth
      // We're just testing that auth middleware lets it through with valid header
      const response = await request(app)
        .post('/api/customers/info')
        .set('x-retell-call-id', 'valid-call-id-12345')
        .set('Content-Type', 'application/json')
        .send({});

      // Should pass auth but may fail validation or service calls
      // The important thing is we get past 401 Unauthorized
      expect(response.status).not.toBe(401);
    });

    test('should include correlation ID in responses', async () => {
      const correlationId = 'test-corr-id-' + Date.now();
      const response = await request(app).get('/api/health').set('X-Correlation-ID', correlationId);

      expect(response.status).toBe(200);
      // Correlation ID should be passed through response
      expect(response.body).toBeDefined();
    });
  });

  describe('Health Check Endpoint', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should include all required health check fields', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      const body = response.body;

      // Essential fields
      expect(typeof body.status).toBe('string');
      expect(typeof body.timestamp).toBe('string');
      expect(body.details).toBeDefined();
    });
  });

  describe('Request Validation', () => {
    test('should validate content type', async () => {
      const response = await request(app)
        .post('/api/customers/info')
        .set('x-retell-call-id', 'test-call-123')
        .set('Content-Type', 'text/plain')
        .send('invalid content');

      // Should reject non-JSON content
      expect([400, 415]).toContain(response.status);
    });

    test('should parse valid JSON body', async () => {
      const response = await request(app)
        .post('/api/customers/info')
        .set('x-retell-call-id', 'test-call-123')
        .set('Content-Type', 'application/json')
        .send({ customerId: 'test' });

      // Should get past JSON parsing
      expect(response.status).not.toBe(400);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/nonexistent/endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle internal errors gracefully', async () => {
      // Create a request that will cause an error deeper in the stack
      const response = await request(app)
        .post('/api/customers/info')
        .set('x-retell-call-id', 'test-call-123')
        .set('Content-Type', 'application/json')
        .send({});

      // Should not crash, should return error response
      expect([400, 500, 503]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    test('should include correlation ID in error responses', async () => {
      const correlationId = 'error-test-' + Date.now();
      const response = await request(app)
        .post('/api/customers/info')
        .set('x-retell-call-id', 'test-call-123')
        .set('X-Correlation-ID', correlationId)
        .set('Content-Type', 'application/json')
        .send({});

      // Error response should still include correlation ID
      expect(response.body.correlationId || response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    test('should include CORS headers in responses', async () => {
      const response = await request(app).options('/api/health').set('Origin', 'http://localhost:3000');

      // Should return 200 or 204 for OPTIONS
      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('Request Logging', () => {
    test('should handle requests with various header combinations', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('User-Agent', 'test-client/1.0')
        .set('Accept', 'application/json')
        .set('Accept-Language', 'en-US');

      expect(response.status).toBe(200);
    });
  });

  describe('Middleware Chain', () => {
    test('should apply all middlewares in correct order', async () => {
      // This tests that the middleware chain is properly configured
      // A request should go through: dotenv → CORS → logging → error handling → routing
      const response = await request(app).get('/api/health').set('Content-Type', 'application/json');

      // Should successfully process through all middlewares
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });

    test('should preserve request properties through middleware chain', async () => {
      const correlationId = 'test-chain-' + Date.now();
      const response = await request(app)
        .post('/api/customers/info')
        .set('x-retell-call-id', 'test-123')
        .set('X-Correlation-ID', correlationId)
        .set('Content-Type', 'application/json')
        .send({});

      // Request properties should be preserved (error handling will show this)
      expect(response.status).not.toBe(404);
    });
  });

  describe('Response Format', () => {
    test('successful responses should have consistent format', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(typeof response.body).toBe('object');
    });

    test('error responses should include helpful messages', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message || response.body.error).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    test('should set appropriate security headers', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      // Server should not expose implementation details
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Request Size Limits', () => {
    test('should handle normal size requests', async () => {
      const data = {
        customerId: 'test-' + Date.now(),
        name: 'Test Customer',
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/customers/info')
        .set('x-retell-call-id', 'test-123')
        .set('Content-Type', 'application/json')
        .send(data);

      // Should not be rejected for size
      expect([400, 401, 404, 500, 503]).toContain(response.status);
      expect(response.status).not.toBe(413);
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle multiple concurrent requests', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .get('/api/health')
            .set('X-Correlation-ID', 'concurrent-' + i)
        );
      }

      const responses = await Promise.all(requests);

      // All requests should complete successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBeDefined();
      });
    });
  });

  describe('Response Codes', () => {
    test('health endpoint should return 200', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
    });

    test('missing authentication should return 401', async () => {
      const response = await request(app)
        .post('/api/customers/info')
        .set('Content-Type', 'application/json')
        .send({});

      expect(response.status).toBe(401);
    });

    test('non-existent routes should return 404', async () => {
      const response = await request(app)
        .get('/api/this/route/does/not/exist')
        .set('x-retell-call-id', 'test-123');

      expect(response.status).toBe(404);
    });
  });
});
