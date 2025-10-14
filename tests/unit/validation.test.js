const {
  validateStringField,
  validateNumericField,
  validateArrayField,
  validateEmailAddress,
  validatePhoneNumber,
  validateSquareId,
  validateDaysAhead,
  validatePagination,
  formatPhoneNumber,
  sanitizeForLogs
} = require('../../src/utils/validation');

describe('Consolidated Validation', () => {
  describe('validateStringField', () => {
    test('should validate required string successfully', () => {
      const result = validateStringField('Hello World', 'testField');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('Hello World');
    });

    test('should trim whitespace', () => {
      const result = validateStringField('  Hello World  ', 'testField');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('Hello World');
    });

    test('should reject empty strings by default', () => {
      const result = validateStringField('', 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    test('should validate with pattern', () => {
      const pattern = /^[A-Z0-9_-]+$/i;
      const result = validateStringField('VALID_123', 'testField', { pattern });
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('VALID_123');
    });

    test('should reject invalid pattern', () => {
      const pattern = /^[A-Z0-9_-]+$/i;
      const result = validateStringField('invalid@#', 'testField', { pattern });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    test('should allow null for optional fields', () => {
      const result = validateStringField(null, 'testField', { required: false });
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(null);
    });
  });

  describe('validateNumericField', () => {
    test('should validate positive numbers', () => {
      const result = validateNumericField(42, 'testField');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(42);
    });

    test('should validate string numbers', () => {
      const result = validateNumericField('42', 'testField');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(42);
    });

    test('should validate range constraints', () => {
      const result = validateNumericField(5, 'testField', { min: 1, max: 10 });
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(5);
    });

    test('should reject values below minimum', () => {
      const result = validateNumericField(0, 'testField', { min: 1 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be at least 1');
    });

    test('should reject decimals when integers required', () => {
      const result = validateNumericField(42.5, 'testField', { allowDecimals: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be an integer');
    });
  });

  describe('validateArrayField', () => {
    test('should validate arrays', () => {
      const result = validateArrayField([1, 2, 3], 'testField');
      expect(result.isValid).toBe(true);
      expect(result.value).toEqual([1, 2, 3]);
    });

    test('should reject arrays that are too short', () => {
      const result = validateArrayField([1], 'testField', { minLength: 2 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must have at least 2 items');
    });

    test('should reject non-array values', () => {
      const result = validateArrayField('not an array', 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be an array');
    });
  });

  describe('validateEmailAddress', () => {
    test('should validate valid email addresses', () => {
      const result = validateEmailAddress('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('test@example.com');
    });

    test('should normalize email to lowercase', () => {
      const result = validateEmailAddress('TEST@EXAMPLE.COM');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('test@example.com');
    });

    test('should reject invalid email formats', () => {
      const result = validateEmailAddress('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid email address format');
    });

    test('should handle optional emails', () => {
      const result = validateEmailAddress('', false);
      expect(result.isValid).toBe(true);
    });

    test('should reject emails that are too long', () => {
      const longEmail = `${'a'.repeat(250)}@example.com`;
      const result = validateEmailAddress(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('validatePhoneNumber', () => {
    test('should validate US phone numbers', () => {
      const result = validatePhoneNumber('+12345678901');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('+12345678901');
    });

    test('should validate formatted phone numbers', () => {
      const result = validatePhoneNumber('(234) 567-8901');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('(234) 567-8901');
    });

    test('should reject invalid phone numbers', () => {
      const result = validatePhoneNumber('123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number must have at least 10 digits');
    });

    test('should handle optional phone numbers', () => {
      const result = validatePhoneNumber('', false);
      expect(result.isValid).toBe(true);
    });

    test('should reject non-string values', () => {
      const result = validatePhoneNumber(123456789);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phone number must be a string');
    });
  });

  describe('validateSquareId', () => {
    test('should validate valid Square IDs', () => {
      const result = validateSquareId('VALID_SQUARE_ID_123', 'testId');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('VALID_SQUARE_ID_123');
    });

    test('should reject IDs that are too short', () => {
      const result = validateSquareId('SHORT', 'testId');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too short');
    });

    test('should reject IDs with invalid characters', () => {
      const result = validateSquareId('INVALID@ID', 'testId');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    test('should allow null when specified', () => {
      const result = validateSquareId('', 'testId', { allowNull: true });
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(null);
    });
  });

  describe('validateDaysAhead', () => {
    test('should return default value for empty input', () => {
      const result = validateDaysAhead('');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(10);
    });

    test('should validate numeric strings', () => {
      const result = validateDaysAhead('30');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(30);
    });

    test('should reject values outside range', () => {
      const result = validateDaysAhead('100');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('between 1 and 90');
    });

    test('should use custom default value', () => {
      const result = validateDaysAhead(null, 15);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(15);
    });
  });

  describe('validatePagination', () => {
    test('should validate pagination parameters', () => {
      const result = validatePagination({ limit: 25, offset: 50 });
      expect(result.isValid).toBe(true);
      expect(result.pagination.limit).toBe(25);
      expect(result.pagination.offset).toBe(50);
    });

    test('should use default values', () => {
      const result = validatePagination({});
      expect(result.isValid).toBe(true);
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.offset).toBe(0);
    });

    test('should reject invalid limit', () => {
      const result = validatePagination({ limit: 150 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('limit must be no more than 100');
    });
  });

  describe('formatPhoneNumber', () => {
    test('should format 10-digit US numbers', () => {
      const result = formatPhoneNumber('2345678901');
      expect(result).toBe('+12345678901');
    });

    test('should format 11-digit US numbers', () => {
      const result = formatPhoneNumber('12345678901');
      expect(result).toBe('+12345678901');
    });

    test('should handle already formatted numbers', () => {
      const result = formatPhoneNumber('+12345678901');
      expect(result).toBe('+12345678901');
    });

    test('should handle null input', () => {
      const result = formatPhoneNumber(null);
      expect(result).toBe(null);
    });
  });

  describe('sanitizeForLogs', () => {
    test('should sanitize email addresses', () => {
      const result = sanitizeForLogs('Contact test@example.com for support');
      expect(result).toBe('Contact [EMAIL] for support');
    });

    test('should sanitize phone numbers', () => {
      const result = sanitizeForLogs('Call (234) 567-8901 for help');
      expect(result).toBe('Call [PHONE] for help');
    });

    test('should sanitize credit card numbers', () => {
      const result = sanitizeForLogs('Card: 1234 5678 9012 3456');
      expect(result).toBe('Card: [CARD]');
    });

    test('should sanitize SSN', () => {
      const result = sanitizeForLogs('SSN: 123-45-6789');
      expect(result).toBe('SSN: [SSN]');
    });

    test('should handle non-string input', () => {
      const result = sanitizeForLogs(123);
      expect(result).toBe(123);
    });
  });
});
