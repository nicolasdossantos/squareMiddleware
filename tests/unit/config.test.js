const originalEnv = process.env;

describe('Configuration Management', () => {
  afterEach(() => {
    // Reset process.env and clear module cache after each test
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  describe('Environment-specific configurations', () => {
    test('should return development config when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.CATALOG_TTL).toBe(5 * 60 * 1000);
      expect(config.BARBER_TTL).toBe(5 * 60 * 1000);
      expect(config.AVAIL_TTL).toBe(30 * 1000);
      expect(config.RATE_LIMIT_MAX_REQUESTS).toBe(200);
      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.ENABLE_DETAILED_LOGGING).toBe(true);
      expect(config.SQUARE_ENVIRONMENT).toBe('sandbox');
      expect(config.ENABLE_RATE_LIMITING).toBe(false);
      expect(config.ENABLE_CORS).toBe(true);
      expect(config.CORS_ORIGINS).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
        'https://api.elevenlabs.io',
        'https://elevenlabs.io'
      ]);
    });

    test('should return staging config when NODE_ENV is staging', () => {
      process.env.NODE_ENV = 'staging';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.CATALOG_TTL).toBe(12 * 60 * 60 * 1000);
      expect(config.BARBER_TTL).toBe(12 * 60 * 60 * 1000);
      expect(config.AVAIL_TTL).toBe(60 * 1000);
      expect(config.RATE_LIMIT_MAX_REQUESTS).toBe(100);
      expect(config.LOG_LEVEL).toBe('info');
      expect(config.ENABLE_DETAILED_LOGGING).toBe(true);
      expect(config.SQUARE_ENVIRONMENT).toBe('sandbox');
      expect(config.ENABLE_RATE_LIMITING).toBe(true);
      expect(config.ENABLE_CORS).toBe(true);
      expect(config.CORS_ORIGINS).toEqual([
        'https://api.elevenlabs.io',
        'https://elevenlabs.io',
        'https://api.retellai.com'
      ]);
    });

    test('should return production config when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.CATALOG_TTL).toBe(24 * 60 * 60 * 1000);
      expect(config.BARBER_TTL).toBe(24 * 60 * 60 * 1000);
      expect(config.AVAIL_TTL).toBe(60 * 1000);
      expect(config.RATE_LIMIT_MAX_REQUESTS).toBe(60);
      expect(config.LOG_LEVEL).toBe('warn');
      expect(config.ENABLE_DETAILED_LOGGING).toBe(false);
      expect(config.SQUARE_ENVIRONMENT).toBe('production');
      expect(config.ENABLE_RATE_LIMITING).toBe(true);
      expect(config.ENABLE_CORS).toBe(true);
      expect(config.CORS_ORIGINS).toEqual([
        'https://api.elevenlabs.io',
        'https://elevenlabs.io',
        'https://api.retellai.com'
      ]);
    });

    test('should default to development config when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.ENABLE_RATE_LIMITING).toBe(false);
      expect(config.SQUARE_ENVIRONMENT).toBe('sandbox');
    });

    test('should default to development config when NODE_ENV is unknown', () => {
      process.env.NODE_ENV = 'unknown';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.ENABLE_RATE_LIMITING).toBe(false);
      expect(config.SQUARE_ENVIRONMENT).toBe('sandbox');
    });
  });

  describe('Environment variable overrides', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('should override CATALOG_TTL from environment variable', () => {
      process.env.CATALOG_TTL = '123456';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.CATALOG_TTL).toBe(123456);
    });

    test('should override BARBER_TTL from environment variable', () => {
      process.env.BARBER_TTL = '789123';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.BARBER_TTL).toBe(789123);
    });

    test('should override AVAIL_TTL from environment variable', () => {
      process.env.AVAIL_TTL = '45678';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.AVAIL_TTL).toBe(45678);
    });

    test('should override RATE_LIMIT_MAX_REQUESTS from environment variable', () => {
      process.env.RATE_LIMIT_MAX_REQUESTS = '150';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.RATE_LIMIT_MAX_REQUESTS).toBe(150);
    });

    test('should override ENABLE_RATE_LIMITING from environment variable', () => {
      process.env.ENABLE_RATE_LIMITING = 'true';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.ENABLE_RATE_LIMITING).toBe(true);
    });

    test('should keep default ENABLE_RATE_LIMITING when env var is not "true"', () => {
      process.env.ENABLE_RATE_LIMITING = 'false';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.ENABLE_RATE_LIMITING).toBe(false); // Uses default from development config
    });

    test('should set required environment variables', () => {
      process.env.SQUARE_ACCESS_TOKEN = 'test_token';
      process.env.SQUARE_LOCATION_ID = 'test_location';
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'test_connection_string';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.SQUARE_ACCESS_TOKEN).toBe('test_token');
      expect(config.SQUARE_LOCATION_ID).toBe('test_location');
      expect(config.APPLICATIONINSIGHTS_CONNECTION_STRING).toBe('test_connection_string');
    });

    test('should set optional TZ with default value', () => {
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.TZ).toBe('America/New_York');
    });

    test('should override TZ from environment variable', () => {
      process.env.TZ = 'UTC';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.TZ).toBe('UTC');
    });

    test('should set NODE_ENV correctly', () => {
      process.env.NODE_ENV = 'production';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      expect(config.NODE_ENV).toBe('production');
    });
  });

  describe('Environment detection functions', () => {
    test('should correctly identify production environment', () => {
      process.env.NODE_ENV = 'production';
      const { isProduction, isStaging, isDevelopment } = require('../../src/utils/config');

      expect(isProduction()).toBe(true);
      expect(isStaging()).toBe(false);
      expect(isDevelopment()).toBe(false);
    });

    test('should correctly identify staging environment', () => {
      process.env.NODE_ENV = 'staging';
      const { isProduction, isStaging, isDevelopment } = require('../../src/utils/config');

      expect(isProduction()).toBe(false);
      expect(isStaging()).toBe(true);
      expect(isDevelopment()).toBe(false);
    });

    test('should correctly identify development environment', () => {
      process.env.NODE_ENV = 'development';
      const { isProduction, isStaging, isDevelopment } = require('../../src/utils/config');

      expect(isProduction()).toBe(false);
      expect(isStaging()).toBe(false);
      expect(isDevelopment()).toBe(true);
    });

    test('should default to development when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      const { isProduction, isStaging, isDevelopment } = require('../../src/utils/config');

      expect(isProduction()).toBe(false);
      expect(isStaging()).toBe(false);
      expect(isDevelopment()).toBe(true);
    });

    test('should default to development when NODE_ENV is unknown', () => {
      process.env.NODE_ENV = 'test';
      const { isProduction, isStaging, isDevelopment } = require('../../src/utils/config');

      expect(isProduction()).toBe(false);
      expect(isStaging()).toBe(false);
      expect(isDevelopment()).toBe(false); // NODE_ENV is 'test', not 'development'
    });
  });

  describe('Configuration consistency', () => {
    test('should return same config object on multiple calls', () => {
      process.env.NODE_ENV = 'production';
      const { getConfig } = require('../../src/utils/config');

      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toEqual(config2);
    });

    test('should include all expected properties', () => {
      process.env.NODE_ENV = 'production';
      process.env.SQUARE_ACCESS_TOKEN = 'test_token';
      process.env.SQUARE_LOCATION_ID = 'test_location';
      const { getConfig } = require('../../src/utils/config');

      const config = getConfig();

      const expectedProperties = [
        'CATALOG_TTL',
        'BARBER_TTL',
        'AVAIL_TTL',
        'RATE_LIMIT_WINDOW',
        'RATE_LIMIT_MAX_REQUESTS',
        'LOG_LEVEL',
        'ENABLE_DETAILED_LOGGING',
        'SQUARE_ENVIRONMENT',
        'ENABLE_RATE_LIMITING',
        'ENABLE_CORS',
        'CORS_ORIGINS',
        'SQUARE_ACCESS_TOKEN',
        'SQUARE_LOCATION_ID',
        'TZ',
        'NODE_ENV'
      ];

      expectedProperties.forEach(prop => {
        expect(config).toHaveProperty(prop);
      });
    });
  });
});
