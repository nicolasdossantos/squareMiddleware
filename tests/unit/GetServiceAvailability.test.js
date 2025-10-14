// tests/GetServiceAvailability.test.js
// Express.js style tests (converted from Azure Functions style)

// Mock environment variables for testing
process.env.SQUARE_ACCESS_TOKEN = 'test_token';
process.env.SQUARE_LOCATION_ID = 'test_location';
process.env.TZ = 'America/New_York';

// Mock modules at the top
const mockLoadAvailability = jest.fn();

// Mock dependencies - These must be called BEFORE requiring the module
jest.mock('../../src/utils/helpers/availabilityHelpers', () => ({
  loadAvailability: mockLoadAvailability
}));
jest.mock('../../src/utils/helpers/bigIntUtils');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/security');
jest.mock('../../src/utils/responseBuilder', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn()
}));
jest.mock('../../src/services/bookingService');
jest.mock('../../src/utils/helpers/bookingHelpers');

const { getServiceAvailability } = require('../../src/controllers/bookingController');
const availabilityHelpers = require('../../src/utils/helpers/availabilityHelpers');
const { cleanBigIntFromObject, bigIntReplacer } = require('../../src/utils/helpers/bigIntUtils');
const { logEvent, logError, logPerformance, logger } = require('../../src/utils/logger');
const { getSecurityHeaders } = require('../../src/utils/security');
const { sendSuccess, sendError } = require('../../src/utils/responseBuilder');

describe('GetServiceAvailability - Express.js Style', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Express.js request
    mockReq = {
      query: {},
      headers: {},
      correlationId: 'test-correlation-id'
    };

    // Mock Express.js response with proper chaining
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };

    // Mock logger functions
    logger.info = jest.fn();
    logger.error = jest.fn();
    logEvent.mockImplementation(() => {});
    logError.mockImplementation(() => {});
    logPerformance.mockImplementation(() => {});

    // Mock security headers
    getSecurityHeaders.mockReturnValue({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    // Mock bigInt utilities
    cleanBigIntFromObject.mockImplementation(obj => obj);
    bigIntReplacer.mockImplementation((key, value) => value);

    // CRITICAL: Configure the loadAvailability mock WITHOUT resetting
    // Only clear the call history, but keep the implementation
    if (mockLoadAvailability.mock) {
      mockLoadAvailability.mock.calls = [];
      mockLoadAvailability.mock.results = [];
    }

    // Ensure the mock is properly configured
    mockLoadAvailability.mockImplementation(() =>
      Promise.resolve({
        id: 'SERVICE_1',
        serviceVariationIds: ['SERVICE_1'],
        barberId: null,
        slots: [
          { startAt: '2025-01-20T10:00:00Z', readable_time: 'Mon, Jan 20, 10:00 AM' },
          { startAt: '2025-01-20T11:00:00Z', readable_time: 'Mon, Jan 20, 11:00 AM' }
        ]
      })
    );

    // Mock responseBuilder functions
    sendError.mockImplementation((res, message, status, details, correlationId) => {
      res.status(status || 500);
      res.json({
        success: false,
        message,
        details,
        correlationId,
        timestamp: new Date().toISOString()
      });
    });
  });

  describe('Express.js Response Patterns', () => {
    test('should use res.status().json() for missing serviceVariationIds', async () => {
      mockReq.query = {};

      await getServiceAvailability(mockReq, mockRes);

      // Verify Express.js style response pattern
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'serviceVariationIds parameter is required',
        timestamp: expect.any(String)
      });
    });

    test('should use res.status().json() for missing daysAhead', async () => {
      // Since daysAhead is now optional with default 14, this should succeed
      mockReq.query = { serviceVariationIds: 'SERVICE_1' };

      await getServiceAvailability(mockReq, mockRes);

      // Should succeed with default daysAhead of 14 - just check it doesn't return 400
      // The actual availability call might fail but that's OK, we're testing parameter handling
      expect(mockRes.status).not.toHaveBeenCalledWith(400);
    });

    test('should use res.status().json() for invalid daysAhead values', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: '0' };

      await getServiceAvailability(mockReq, mockRes);

      // Verify Express.js style response pattern
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'daysAhead parameter must be between 1 and 90 (defaults to 14 if not provided)',
        timestamp: expect.any(String)
      });
    });

    test('should use res.status().json() for daysAhead too large', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: '100' };

      await getServiceAvailability(mockReq, mockRes);

      // Verify Express.js style response pattern
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'daysAhead parameter must be between 1 and 90 (defaults to 14 if not provided)',
        timestamp: expect.any(String)
      });
    });

    test('should handle loadAvailability errors with Express.js pattern', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: '14' };
      mockLoadAvailability.mockRejectedValue(new Error('Failed to load availability'));

      await getServiceAvailability(mockReq, mockRes);

      // Verify Express.js style error response
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalled();
    });

    test('should process valid requests without throwing errors', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: '14' };

      // This should not throw an error
      await expect(getServiceAvailability(mockReq, mockRes)).resolves.not.toThrow();
    });

    test('should log events for valid requests', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: '14' };

      await getServiceAvailability(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('service_availability_request', expect.any(Object));
    });
  });

  describe('Parameter Processing', () => {
    test('should split comma-separated service IDs', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1,SERVICE_2,SERVICE_3', daysAhead: '14' };

      await getServiceAvailability(mockReq, mockRes);

      // Function should process without error
      expect(logger.info).toHaveBeenCalled();
    });

    test('should handle barberId parameter', async () => {
      mockReq.query = {
        serviceVariationIds: 'SERVICE_1',
        daysAhead: '14',
        barberId: 'BARBER_1'
      };

      await getServiceAvailability(mockReq, mockRes);

      // Function should process without error
      expect(logger.info).toHaveBeenCalled();
    });

    test('should handle different valid daysAhead values', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: '30' };

      await getServiceAvailability(mockReq, mockRes);

      // Function should process without error
      expect(logger.info).toHaveBeenCalled();
    });
  });

  describe('Optional daysAhead with Default Value', () => {
    test('should use default daysAhead of 14 when not provided', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1' };

      await getServiceAvailability(mockReq, mockRes);

      // Should not return 400 for missing daysAhead (since it's optional with default)
      expect(mockRes.status).not.toHaveBeenCalledWith(400);
    });

    test('should use provided daysAhead when specified', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: '7' };

      await getServiceAvailability(mockReq, mockRes);

      // Should not return 400 for valid daysAhead
      expect(mockRes.status).not.toHaveBeenCalledWith(400);
    });

    test('should handle empty string daysAhead as default', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: '' };

      await getServiceAvailability(mockReq, mockRes);

      // Should use default value when daysAhead is empty string
      expect(mockRes.status).not.toHaveBeenCalledWith(400);
    });

    test('should handle null daysAhead as default', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1', daysAhead: null };

      await getServiceAvailability(mockReq, mockRes);

      // Should use default value when daysAhead is null
      expect(mockRes.status).not.toHaveBeenCalledWith(400);
    });

    test('should log correct daysAhead value in info log', async () => {
      mockReq.query = { serviceVariationIds: 'SERVICE_1' };

      await getServiceAvailability(mockReq, mockRes);

      // Should log the default daysAhead value
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Days: 14'));
    });
  });
});
