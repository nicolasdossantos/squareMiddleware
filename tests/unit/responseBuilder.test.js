const {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createRateLimitResponse,
  createInternalErrorResponse,
  createMethodNotAllowedResponse,
  createNotFoundResponse
} = require('../../src/utils/responseBuilder');

// Mock security headers
jest.mock('../../src/utils/security', () => ({
  getSecurityHeaders: jest.fn(() => ({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  }))
}));

describe('Response Builder', () => {
  const mockCorrelationId = 'test-correlation-id';

  describe('createSuccessResponse', () => {
    test('should create basic success response', () => {
      const data = { message: 'Success' };
      const result = createSuccessResponse(data);

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.jsonBody.success).toBe(true);
      expect(result.jsonBody.message).toBe('Success');
    });

    test('should include correlation ID when provided', () => {
      const data = { message: 'Success' };
      const result = createSuccessResponse(data, 200, mockCorrelationId);

      expect(result.headers['X-Correlation-ID']).toBe(mockCorrelationId);
      expect(result.jsonBody.correlation_id).toBe(mockCorrelationId);
    });

    test('should support custom status code', () => {
      const data = { created: true };
      const result = createSuccessResponse(data, 201);

      expect(result.status).toBe(201);
      expect(result.jsonBody.success).toBe(true);
      expect(result.jsonBody.created).toBe(true);
    });

    test('should merge additional headers', () => {
      const data = { message: 'Success' };
      const additionalHeaders = { 'X-Custom-Header': 'test' };
      const result = createSuccessResponse(data, 200, null, additionalHeaders);

      expect(result.headers['X-Custom-Header']).toBe('test');
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    test('should include security headers', () => {
      const data = { message: 'Success' };
      const result = createSuccessResponse(data);

      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers['X-Frame-Options']).toBe('DENY');
      expect(result.headers['X-XSS-Protection']).toBe('1; mode=block');
    });
  });

  describe('createErrorResponse', () => {
    test('should create basic error response', () => {
      const result = createErrorResponse(400, 'Bad Request', 'Invalid data');

      expect(result.status).toBe(400);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.jsonBody.success).toBe(false);
      expect(result.jsonBody.error).toBe('Bad Request');
      expect(result.jsonBody.details).toBe('Invalid data');
      expect(result.jsonBody.timestamp).toBeTruthy();
    });

    test('should include correlation ID when provided', () => {
      const result = createErrorResponse(500, 'Server Error', null, mockCorrelationId);

      expect(result.headers['X-Correlation-ID']).toBe(mockCorrelationId);
      expect(result.jsonBody.correlation_id).toBe(mockCorrelationId);
    });

    test('should handle object details', () => {
      const details = { field: 'email', message: 'Invalid format' };
      const result = createErrorResponse(400, 'Validation Error', details);

      expect(result.jsonBody.details).toEqual(details);
    });

    test('should omit details when null', () => {
      const result = createErrorResponse(404, 'Not Found');

      expect(result.jsonBody.details).toBeUndefined();
    });

    test('should merge additional headers', () => {
      const additionalHeaders = { 'Retry-After': '30' };
      const result = createErrorResponse(429, 'Too Many Requests', null, null, additionalHeaders);

      expect(result.headers['Retry-After']).toBe('30');
    });
  });

  describe('createValidationErrorResponse', () => {
    test('should create validation error with single error', () => {
      const result = createValidationErrorResponse('Email is required');

      expect(result.status).toBe(400);
      expect(result.jsonBody.error).toBe('Validation failed');
      expect(result.jsonBody.details).toEqual(['Email is required']);
    });

    test('should create validation error with multiple errors', () => {
      const errors = ['Email is required', 'Phone number is invalid'];
      const result = createValidationErrorResponse(errors);

      expect(result.status).toBe(400);
      expect(result.jsonBody.details).toEqual(errors);
    });

    test('should include correlation ID', () => {
      const result = createValidationErrorResponse('Error', mockCorrelationId);

      expect(result.headers['X-Correlation-ID']).toBe(mockCorrelationId);
      expect(result.jsonBody.correlation_id).toBe(mockCorrelationId);
    });
  });

  describe('createRateLimitResponse', () => {
    test('should create rate limit response with default values', () => {
      const result = createRateLimitResponse('Rate limit exceeded');

      expect(result.status).toBe(429);
      expect(result.jsonBody.error).toBe('Rate limit exceeded');
      expect(result.headers['Retry-After']).toBe('60');
      expect(result.headers['X-RateLimit-Limit']).toBe('100');
      expect(result.headers['X-RateLimit-Remaining']).toBe('0');
      expect(result.headers['X-RateLimit-Reset']).toBe('60');
    });

    test('should support custom reset time', () => {
      const result = createRateLimitResponse('Rate limit exceeded', 120);

      expect(result.headers['Retry-After']).toBe('120');
      expect(result.headers['X-RateLimit-Reset']).toBe('120');
    });

    test('should include correlation ID', () => {
      const result = createRateLimitResponse('Rate limit exceeded', 60, mockCorrelationId);

      expect(result.headers['X-Correlation-ID']).toBe(mockCorrelationId);
      expect(result.jsonBody.correlation_id).toBe(mockCorrelationId);
    });
  });

  describe('createInternalErrorResponse', () => {
    test('should create internal error with default message', () => {
      const result = createInternalErrorResponse();

      expect(result.status).toBe(500);
      expect(result.jsonBody.error).toBe('Internal server error');
    });

    test('should support custom message', () => {
      const result = createInternalErrorResponse('Database connection failed');

      expect(result.jsonBody.error).toBe('Database connection failed');
    });

    test('should include correlation ID', () => {
      const result = createInternalErrorResponse('Error', mockCorrelationId);

      expect(result.headers['X-Correlation-ID']).toBe(mockCorrelationId);
      expect(result.jsonBody.correlation_id).toBe(mockCorrelationId);
    });
  });

  describe('createMethodNotAllowedResponse', () => {
    test('should create method not allowed with default methods', () => {
      const result = createMethodNotAllowedResponse();

      expect(result.status).toBe(405);
      expect(result.jsonBody.error).toBe('Method not allowed');
      expect(result.jsonBody.details).toBe('Allowed methods: GET, POST, PUT, DELETE, OPTIONS');
      expect(result.headers['Allow']).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });

    test('should support custom allowed methods', () => {
      const result = createMethodNotAllowedResponse('GET, POST');

      expect(result.jsonBody.details).toBe('Allowed methods: GET, POST');
      expect(result.headers['Allow']).toBe('GET, POST');
    });

    test('should include correlation ID', () => {
      const result = createMethodNotAllowedResponse('GET, POST', mockCorrelationId);

      expect(result.headers['X-Correlation-ID']).toBe(mockCorrelationId);
      expect(result.jsonBody.correlation_id).toBe(mockCorrelationId);
    });
  });

  describe('createNotFoundResponse', () => {
    test('should create not found with default resource', () => {
      const result = createNotFoundResponse();

      expect(result.status).toBe(404);
      expect(result.jsonBody.error).toBe('Resource not found');
    });

    test('should support custom resource name', () => {
      const result = createNotFoundResponse('Customer');

      expect(result.jsonBody.error).toBe('Customer not found');
    });

    test('should include correlation ID', () => {
      const result = createNotFoundResponse('Booking', mockCorrelationId);

      expect(result.headers['X-Correlation-ID']).toBe(mockCorrelationId);
      expect(result.jsonBody.correlation_id).toBe(mockCorrelationId);
    });
  });
});
