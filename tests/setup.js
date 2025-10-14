/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Mock console.error to filter out expected errors
  console.error = (...args) => {
    const message = args.join(' ');
    // Only show unexpected errors
    if (
      !message.includes('Expected test error') &&
      !message.includes('Mock error') &&
      !message.includes('Test validation')
    ) {
      originalConsoleError(...args);
    }
  };

  // Mock console.warn for cleaner test output
  console.warn = (...args) => {
    const message = args.join(' ');
    if (!message.includes('Test warning')) {
      originalConsoleWarn(...args);
    }
  };
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.testUtils = {
  // Helper to create mock request objects
  createMockReq: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    correlationId: 'test-correlation-id',
    ...overrides
  }),

  // Helper to create mock response objects
  createMockRes: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      locals: {}
    };
    return res;
  },

  // Helper to create mock next function
  createMockNext: () => jest.fn(),

  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate test data
  generateTestCustomer: (overrides = {}) => ({
    id: 'test-customer-id',
    given_name: 'John',
    family_name: 'Doe',
    email_address: 'john.doe@example.com',
    phone_number: '+1234567890',
    ...overrides
  }),

  generateTestBooking: (overrides = {}) => ({
    id: 'test-booking-id',
    appointment_segments: [
      {
        service_variation_id: 'test-service-id',
        team_member_id: 'test-barber-id',
        service_duration: 3600000, // 1 hour in milliseconds
        scheduled_at: new Date().toISOString()
      }
    ],
    location_id: 'test-location-id',
    status: 'ACCEPTED',
    ...overrides
  }),

  // Helper to generate test availability
  generateTestAvailability: (overrides = {}) => ({
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    appointment_segments: [
      {
        duration_minutes: 60,
        service_variation_id: 'test-service-id',
        team_member_id: 'test-barber-id'
      }
    ],
    ...overrides
  })
};

// Global test constants
global.testConstants = {
  VALID_CUSTOMER_ID: 'CUST123',
  VALID_PHONE_NUMBER: '+1234567890',
  VALID_EMAIL: 'test@example.com',
  VALID_SERVICE_ID: 'SERVICE123',
  VALID_BARBER_ID: 'BARBER123',
  VALID_LOCATION_ID: 'LOCATION123',

  INVALID_CUSTOMER_ID: '',
  INVALID_PHONE_NUMBER: 'invalid-phone',
  INVALID_EMAIL: 'invalid-email',

  TEST_CORRELATION_ID: 'test-correlation-id-12345'
};

// Global error handlers for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});

// Clean up after tests
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
});

beforeEach(() => {
  // Reset modules to ensure clean state
  jest.resetModules();
});
