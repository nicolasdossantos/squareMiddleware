// tests/integration.test.js
const { validateEnvironment } = require('../../src/utils/squareUtils');

// Mock context for testing
const createMockContext = () => ({
  log: jest.fn(),
  res: null
});

// Mock request object
const createMockRequest = (query = {}) => ({
  query
});

// Mock environment variables for testing
const originalEnv = process.env;

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.resetModules();
    // Ensure all required environment variables are set
    process.env = {
      ...originalEnv,
      SQUARE_ACCESS_TOKEN: 'test_token_with_sufficient_length_for_validation',
      SQUARE_LOCATION_ID: 'test_location',
      TZ: 'America/New_York'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe.skip('GetMetaData Function', () => {
    test('should handle valid request', async () => {
      const getMetaData = require('../GetMetaData/index.js');
      const context = createMockContext();
      const req = createMockRequest();

      // Mock the Square API calls to avoid real API calls in tests
      jest.doMock('../../src/utils/squareUtils', () => ({
        validateEnvironment: jest.fn(),
        loadServiceVariations: jest.fn().mockResolvedValue({
          services: [
            {
              id: 'test-service',
              name: 'Test Service',
              variations: []
            }
          ]
        }),
        loadBarbers: jest.fn().mockResolvedValue({
          barbers: [
            {
              id: 'test-barber',
              firstName: 'Test',
              lastName: 'Barber'
            }
          ]
        })
      }));

      await getMetaData(context, req);

      expect(context.res.status).toBe(200);
      expect(context.res.headers['Content-Type']).toBe('application/json');

      const response = JSON.parse(context.res.body);
      expect(response).toHaveProperty('services');
      expect(response).toHaveProperty('barbers');
    });

    test('should handle missing environment variables', async () => {
      delete process.env.SQUARE_ACCESS_TOKEN;

      const getMetaData = require('../GetMetaData/index.js');
      const context = createMockContext();
      const req = createMockRequest();

      await getMetaData(context, req);

      expect(context.res.status).toBeGreaterThanOrEqual(500);
    });
  });

  describe.skip('GetServiceAvailability Function', () => {
    test('should handle valid request with service parameter', async () => {
      const getServiceAvailability = require('../src/functions/GetServiceAvailability.js');
      const context = createMockContext();
      const req = createMockRequest({ service: 'TEST_SERVICE_ID' });

      // Mock the Square API calls
      jest.doMock('../../src/utils/squareUtils', () => ({
        validateEnvironment: jest.fn(),
        validateServiceVariationId: jest.fn(),
        validateBarberId: jest.fn(),
        validateDaysAhead: jest.fn().mockReturnValue(14),
        loadServiceVariations: jest.fn().mockResolvedValue({
          services: [
            {
              id: 'parent-service',
              name: 'Test Service',
              variations: [
                {
                  id: 'TEST_SERVICE_ID',
                  name: 'Test Variation'
                }
              ]
            }
          ]
        }),
        loadAvailability: jest.fn().mockResolvedValue({
          id: 'TEST_SERVICE_ID',
          slots: [
            {
              startAt: '2025-05-28T14:00:00Z',
              readable_time: 'Wed, May 28, 10:00 AM',
              appointmentSegments: []
            }
          ]
        })
      }));

      await getServiceAvailability(context, req);

      expect(context.res.status).toBe(200);

      const response = JSON.parse(context.res.body);
      expect(response).toHaveProperty('service');
      expect(response).toHaveProperty('availability_count');
      expect(response).toHaveProperty('data');
    });

    test('should return 400 for missing service parameter', async () => {
      const getServiceAvailability = require('../src/functions/GetServiceAvailability.js');
      const context = createMockContext();
      const req = createMockRequest({}); // No service parameter

      await getServiceAvailability(context, req);

      expect(context.res.status).toBe(400);

      const response = JSON.parse(context.res.body);
      expect(response.error).toContain('Missing required parameter');
    });

    test('should return 404 for non-existent service', async () => {
      const getServiceAvailability = require('../src/functions/GetServiceAvailability.js');
      const context = createMockContext();
      const req = createMockRequest({ service: 'NON_EXISTENT_SERVICE' });

      // Mock the Square API calls
      jest.doMock('../../src/utils/squareUtils', () => ({
        validateEnvironment: jest.fn(),
        validateServiceVariationId: jest.fn(),
        validateBarberId: jest.fn(),
        validateDaysAhead: jest.fn().mockReturnValue(14),
        loadServiceVariations: jest.fn().mockResolvedValue({
          services: [] // No services
        })
      }));

      await getServiceAvailability(context, req);

      expect(context.res.status).toBe(404);

      const response = JSON.parse(context.res.body);
      expect(response.error).toContain('not found');
    });
  });

  describe('Environment Validation', () => {
    test('should pass with valid environment', () => {
      // Environment variables are already set in beforeEach
      expect(() => validateEnvironment()).not.toThrow();
    });

    test('should fail with missing SQUARE_ACCESS_TOKEN', () => {
      delete process.env.SQUARE_ACCESS_TOKEN;
      expect(() => validateEnvironment()).toThrow('Missing Square environment variables');
    });

    test('should fail with missing SQUARE_LOCATION_ID', () => {
      delete process.env.SQUARE_LOCATION_ID;
      expect(() => validateEnvironment()).toThrow('Missing Square environment variables');
    });
  });
});
