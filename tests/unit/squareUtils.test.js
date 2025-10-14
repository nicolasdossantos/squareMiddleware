// tests/squareUtils.test.js

// Mock environment variables for testing
process.env.SQUARE_ACCESS_TOKEN = 'test_token';
process.env.SQUARE_LOCATION_ID = 'test_location';
process.env.TZ = 'America/New_York';

const {
  validateServiceVariationId,
  validateBarberId,
  validateDaysAhead,
  fmtLocal,
  validateEnvironment
} = require('../../src/utils/squareUtils');

describe('squareUtils', () => {
  describe('validateServiceVariationId', () => {
    test('should accept valid service variation ID', () => {
      const result = validateServiceVariationId('YXAQPKIW2HG4J4HKNTFYIRCV');
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid characters', () => {
      const result = validateServiceVariationId('invalid@id');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    test('should reject empty string', () => {
      const result = validateServiceVariationId('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid service variation ID');
    });

    test('should reject null/undefined', () => {
      const result1 = validateServiceVariationId(null);
      const result2 = validateServiceVariationId(undefined);
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('Invalid service variation ID');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('Invalid service variation ID');
    });
  });

  describe('validateBarberId', () => {
    test('should accept valid barber ID', async () => {
      const result = await validateBarberId(null, 'TMjrjeysZMBiYlvw');
      expect(result.isValid).toBe(true);
    });

    test('should accept null/undefined (optional parameter)', async () => {
      const result1 = await validateBarberId(null, null);
      const result2 = await validateBarberId(null, undefined);
      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
    });

    test('should reject invalid characters when provided', async () => {
      const result = await validateBarberId(null, 'invalid@id');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });
  });

  describe('validateDaysAhead', () => {
    test('should accept valid days range', () => {
      expect(validateDaysAhead('14')).toEqual({ isValid: true, value: 14 });
      expect(validateDaysAhead('1')).toEqual({ isValid: true, value: 1 });
      expect(validateDaysAhead('90')).toEqual({ isValid: true, value: 90 });
    });

    test('should reject out of range values', () => {
      expect(validateDaysAhead('0')).toEqual({ isValid: false, error: 'Days ahead must be between 1 and 90' });
      expect(validateDaysAhead('91')).toEqual({ isValid: false, error: 'Days ahead must be between 1 and 90' });
    });

    test('should reject non-numeric values', () => {
      expect(validateDaysAhead('abc')).toEqual({ isValid: false, error: 'Days ahead must be between 1 and 90' });
    });
  });

  describe('fmtLocal', () => {
    test('should format date correctly', () => {
      const iso = '2025-05-28T14:00:00Z';
      const formatted = fmtLocal(iso);
      expect(formatted).toMatch(/\w{3}, \w{3} \d{2}, \d{1,2}:\d{2} [AP]M/);
    });
  });

  describe('validateEnvironment', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should pass when all required environment variables are set', () => {
      process.env = {
        ...originalEnv,
        SQUARE_ACCESS_TOKEN: 'test_token_with_sufficient_length_for_validation',
        SQUARE_LOCATION_ID: 'test_location'
      };

      expect(() => validateEnvironment()).not.toThrow();
    });

    test('should throw when SQUARE_ACCESS_TOKEN is missing', () => {
      process.env = {
        ...originalEnv,
        SQUARE_LOCATION_ID: 'test_location'
      };
      delete process.env.SQUARE_ACCESS_TOKEN;

      expect(() => validateEnvironment()).toThrow('Missing Square environment variables');
    });

    test('should throw when SQUARE_LOCATION_ID is missing', () => {
      process.env = {
        ...originalEnv,
        SQUARE_ACCESS_TOKEN: 'test_token'
      };
      delete process.env.SQUARE_LOCATION_ID;

      expect(() => validateEnvironment()).toThrow('Missing Square environment variables');
    });

    test('should throw when both environment variables are missing', () => {
      process.env = { ...originalEnv };
      delete process.env.SQUARE_ACCESS_TOKEN;
      delete process.env.SQUARE_LOCATION_ID;

      expect(() => validateEnvironment()).toThrow('Missing Square environment variables');
    });
  });

  describe('fmtLocal formatting', () => {
    test('should handle different date formats', () => {
      const testDates = ['2025-01-15T09:00:00Z', '2025-12-31T23:59:59Z', '2025-06-15T12:00:00.000Z'];

      testDates.forEach(dateString => {
        const result = fmtLocal(dateString);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(10);
        // Should contain day of week, month, day, and time
        expect(result).toMatch(/\w{3}, \w{3} \d{1,2}, \d{1,2}:\d{2} [AP]M/);
      });
    });

    test('should handle timezone correctly', () => {
      const iso = '2025-06-15T12:00:00Z';
      const formatted = fmtLocal(iso);

      // Should format according to America/New_York timezone
      expect(formatted).toMatch(/\w{3}, \w{3} \d{1,2}, \d{1,2}:\d{2} [AP]M/);
    });

    test('should format weekdays and months correctly', () => {
      // Test different days of the week and months
      const mondayJan = '2025-01-06T12:00:00Z'; // Monday in January
      const result = fmtLocal(mondayJan);

      expect(result).toMatch(/^Mon, Jan \d{1,2}, \d{1,2}:\d{2} [AP]M$/);
    });
  });

  describe('Input validation edge cases', () => {
    test('validateServiceVariationId should handle various invalid formats', () => {
      const invalidIds = [
        '',
        ' ',
        'abc',
        '123',
        'ID_WITH_SPECIAL_CHARS!@#',
        'id with spaces',
        'very_long_id_that_exceeds_normal_length_expectations_and_might_cause_issues_and_is_over_one_hundred_chars',
        null,
        undefined,
        123,
        {},
        []
      ];

      invalidIds.forEach(invalidId => {
        const result = validateServiceVariationId(invalidId);
        expect(result.isValid).toBe(false);
      });
    });

    test('validateBarberId should handle various invalid formats when provided', async () => {
      const invalidIds = ['invalid@id', 'id with spaces', 'ID_WITH_SPECIAL_CHARS!@#', '123', ''];

      for (const invalidId of invalidIds) {
        const result = await validateBarberId(null, invalidId);
        expect(result.isValid).toBe(false);
      }
    });

    test('validateDaysAhead should handle edge cases', () => {
      const invalidInputs = ['0', '91', '100', '-1', 'abc', '1.5', '1a', 'a1'];

      invalidInputs.forEach(invalidInput => {
        const result = validateDaysAhead(invalidInput);
        expect(result.isValid).toBe(false);
      });
    });

    test('validateDaysAhead should return default for empty/null values', () => {
      const emptyInputs = ['', ' ', null, undefined];
      emptyInputs.forEach(emptyInput => {
        const result = validateDaysAhead(emptyInput);
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(10); // Default value
      });
    });

    test('validateDaysAhead should accept boundary values', () => {
      expect(validateDaysAhead('1')).toEqual({ isValid: true, value: 1 });
      expect(validateDaysAhead('90')).toEqual({ isValid: true, value: 90 });
    });

    test('validateDaysAhead should handle string numbers with whitespace', () => {
      expect(validateDaysAhead(' 14 ')).toEqual({ isValid: true, value: 14 });
      expect(validateDaysAhead('\t30\n')).toEqual({ isValid: true, value: 30 });
    });
  });
});
