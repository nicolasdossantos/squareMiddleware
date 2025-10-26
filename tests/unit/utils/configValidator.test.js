/**
 * Tests for Configuration Validator
 * Verifies that configuration validation works correctly for all scenarios
 */

const {
  validateConfiguration,
  validateStartup,
  formatValidationMessage,
  isConfigurationCritical,
  getEnvValue,
  validateConfigOption
} = require('../../../src/utils/configValidator');

describe('Configuration Validator', () => {
  // Save original environment
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear environment variables before each test
    process.env = { ...originalEnv };
    delete process.env.PG_CONNECTION_STRING;
    delete process.env.PG_CONN_STRING;
    delete process.env.POSTGRES_CONNECTION_STRING;
    delete process.env.DATABASE_URL;
    delete process.env.RETELL_API_KEY;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getEnvValue()', () => {
    test('should get value from single environment variable', () => {
      process.env.TEST_VAR = 'test_value';
      const result = getEnvValue('TEST_VAR');
      expect(result).toBe('test_value');
    });

    test('should get value from first available in array', () => {
      process.env.ALT_VAR = 'alt_value';
      const result = getEnvValue(['PRIMARY_VAR', 'ALT_VAR']);
      expect(result).toBe('alt_value');
    });

    test('should return null if no variable is set', () => {
      const result = getEnvValue(['MISSING_1', 'MISSING_2']);
      expect(result).toBeNull();
    });

    test('should prioritize first variable in array', () => {
      process.env.PRIMARY_VAR = 'primary_value';
      process.env.ALT_VAR = 'alt_value';
      const result = getEnvValue(['PRIMARY_VAR', 'ALT_VAR']);
      expect(result).toBe('primary_value');
    });
  });

  describe('validateConfigOption()', () => {
    test('should validate present and valid config', () => {
      process.env.TEST_VAR = 'valid_value';
      const result = validateConfigOption('Test Config', 'TEST_VAR', value => value === 'valid_value');

      expect(result.valid).toBe(true);
      expect(result.value).toBe('valid_value');
      expect(result.error).toBeNull();
    });

    test('should report missing config', () => {
      const result = validateConfigOption('Test Config', 'MISSING_VAR', () => true);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required configuration');
      expect(result.error).toContain('MISSING_VAR');
    });

    test('should report invalid config value', () => {
      process.env.TEST_VAR = 'invalid_value';
      const result = validateConfigOption('Test Config', 'TEST_VAR', value => value === 'valid_value');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    test('should handle multiple env variable names', () => {
      process.env.ALT_VAR = 'alt_value';
      const result = validateConfigOption('Test Config', ['PRIMARY', 'ALT_VAR'], () => true);

      expect(result.valid).toBe(true);
      expect(result.value).toBe('alt_value');
    });
  });

  describe('validateConfiguration()', () => {
    test('should detect missing database connection string', () => {
      process.env.NODE_ENV = 'development';
      process.env.RETELL_API_KEY = 'test_key';

      const result = validateConfiguration();

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('database.connectionString'));
      expect(result.errors).toContainEqual(expect.stringContaining('DATABASE_URL'));
    });

    test('should detect missing Retell API key', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';

      const result = validateConfiguration();

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('retell.apiKey'));
    });

    test('should pass with all required configs in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      const result = validateConfiguration();

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should detect missing production-only configs in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      const result = validateConfiguration();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.environment).toBe('production');
    });

    test('should warn about missing optional Twilio config', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      const result = validateConfiguration();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('SMS and WhatsApp'))).toBe(true);
    });

    test('should validate Retell API key format', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'short';

      const result = validateConfiguration();

      // Short key should fail validation
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('retell.apiKey'))).toBe(true);
    });
  });

  describe('formatValidationMessage()', () => {
    test('should format error message with errors', () => {
      const result = {
        errors: ['Error 1', 'Error 2'],
        warnings: [],
        environment: 'production'
      };

      const message = formatValidationMessage(result);

      expect(message).toContain('CONFIGURATION VALIDATION FAILED');
      expect(message).toContain('Error 1');
      expect(message).toContain('Error 2');
      expect(message).toContain('production');
    });

    test('should format message with warnings only', () => {
      const result = {
        errors: [],
        warnings: ['Warning 1', 'Warning 2'],
        environment: 'development'
      };

      const message = formatValidationMessage(result);

      expect(message).toContain('CONFIGURATION WARNINGS');
      expect(message).toContain('Warning 1');
      expect(message).toContain('Warning 2');
    });

    test('should format message with both errors and warnings', () => {
      const result = {
        errors: ['Error 1'],
        warnings: ['Warning 1'],
        environment: 'development'
      };

      const message = formatValidationMessage(result);

      expect(message).toContain('VALIDATION FAILED');
      expect(message).toContain('Error 1');
      expect(message).toContain('Warning 1');
    });

    test('should return empty string for no errors or warnings', () => {
      const result = {
        errors: [],
        warnings: [],
        environment: 'development'
      };

      const message = formatValidationMessage(result);

      expect(message.trim()).toBe('');
    });
  });

  describe('isConfigurationCritical()', () => {
    test('should return true when errors exist', () => {
      const result = {
        valid: false,
        errors: ['Error 1'],
        warnings: []
      };

      expect(isConfigurationCritical(result)).toBe(true);
    });

    test('should return false when no errors', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: ['Warning 1']
      };

      expect(isConfigurationCritical(result)).toBe(false);
    });
  });

  describe('validateStartup()', () => {
    test('should validate and return result', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      const result = validateStartup(null);

      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    test('should handle logger being null', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      expect(() => validateStartup(null)).not.toThrow();
    });
  });

  describe('Alternative Environment Variable Names', () => {
    test('should accept PG_CONNECTION_STRING', () => {
      process.env.NODE_ENV = 'development';
      process.env.PG_CONNECTION_STRING = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      const result = validateConfiguration();
      expect(result.valid).toBe(true);
    });

    test('should accept PG_CONN_STRING', () => {
      process.env.NODE_ENV = 'development';
      process.env.PG_CONN_STRING = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      const result = validateConfiguration();
      expect(result.valid).toBe(true);
    });

    test('should accept POSTGRES_CONNECTION_STRING', () => {
      process.env.NODE_ENV = 'development';
      process.env.POSTGRES_CONNECTION_STRING = 'postgresql://localhost/test';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      const result = validateConfiguration();
      expect(result.valid).toBe(true);
    });

    test('should prioritize DATABASE_URL last if others are set', () => {
      process.env.NODE_ENV = 'development';
      process.env.PG_CONNECTION_STRING = 'postgresql://localhost/test';
      process.env.DATABASE_URL = 'postgresql://localhost/fallback';
      process.env.RETELL_API_KEY = 'test_key_1234567890';

      const result = validateConfiguration();
      expect(result.valid).toBe(true);
    });
  });
});
