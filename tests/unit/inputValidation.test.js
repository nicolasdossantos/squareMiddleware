const {
  validateStringField,
  validateNumericField,
  validateArrayField,
  validatePagination,
  sanitizeForLogs
} = require('../../src/utils/inputValidation');

describe('Input Validation', () => {
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

    test('should reject strings that are too short', () => {
      const result = validateStringField('Hi', 'testField', { minLength: 5 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be at least 5 characters');
    });

    test('should reject strings that are too long', () => {
      const result = validateStringField('Very long string', 'testField', { maxLength: 5 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be no more than 5 characters');
    });

    test('should allow null for optional fields', () => {
      const result = validateStringField(null, 'testField', { required: false });
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(null);
    });

    test('should reject non-string values', () => {
      const result = validateStringField(123, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be a string');
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

    test('should validate decimal numbers', () => {
      const result = validateNumericField(42.5, 'testField');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(42.5);
    });

    test('should reject decimals when integers required', () => {
      const result = validateNumericField(42.5, 'testField', { allowDecimals: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be an integer');
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

    test('should reject values above maximum', () => {
      const result = validateNumericField(15, 'testField', { max: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be no more than 10');
    });

    test('should reject non-numeric values', () => {
      const result = validateNumericField('not a number', 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be a valid number');
    });
  });

  describe('validateArrayField', () => {
    test('should validate valid arrays', () => {
      const result = validateArrayField([1, 2, 3], 'testField');
      expect(result.isValid).toBe(true);
      expect(result.value).toEqual([1, 2, 3]);
    });

    test('should validate empty arrays', () => {
      const result = validateArrayField([], 'testField');
      expect(result.isValid).toBe(true);
      expect(result.value).toEqual([]);
    });

    test('should reject arrays that are too short', () => {
      const result = validateArrayField([1], 'testField', { minLength: 2 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must have at least 2 items');
    });

    test('should reject arrays that are too long', () => {
      const result = validateArrayField([1, 2, 3], 'testField', { maxLength: 2 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must have no more than 2 items');
    });

    test('should reject non-array values', () => {
      const result = validateArrayField('not an array', 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    test('should allow null for optional fields', () => {
      const result = validateArrayField(null, 'testField', { required: false });
      expect(result.isValid).toBe(true);
      expect(result.value).toEqual([]);
    });
  });

  describe('validatePagination', () => {
    test('should use defaults for empty query', () => {
      const result = validatePagination({});
      expect(result.isValid).toBe(true);
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.offset).toBe(0);
    });

    test('should validate custom limit and offset', () => {
      const result = validatePagination({ limit: '20', offset: '10' });
      expect(result.isValid).toBe(true);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.offset).toBe(10);
    });

    test('should reject invalid limit', () => {
      const result = validatePagination({ limit: '0' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('limit must be at least 1');
    });

    test('should reject limit above maximum', () => {
      const result = validatePagination({ limit: '200' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('limit must be no more than 100');
    });

    test('should reject negative offset', () => {
      const result = validatePagination({ offset: '-1' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('offset must be at least 0');
    });

    test('should reject decimal pagination values', () => {
      const result = validatePagination({ limit: '10.5', offset: '5.5' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('limit must be an integer');
      expect(result.errors).toContain('offset must be an integer');
    });
  });

  describe('sanitizeForLogs', () => {
    test('should sanitize newlines and tabs', () => {
      const result = sanitizeForLogs('Line 1\nLine 2\tTabbed');
      expect(result).toBe('Line 1 Line 2 Tabbed');
    });

    test('should remove angle brackets', () => {
      const result = sanitizeForLogs('<script>alert("xss")</script>');
      expect(result).toBe('scriptalert("xss")/script');
    });

    test('should limit string length', () => {
      const longString = 'a'.repeat(2000);
      const result = sanitizeForLogs(longString);
      expect(result.length).toBe(1000);
    });

    test('should return non-strings unchanged', () => {
      expect(sanitizeForLogs(123)).toBe(123);
      expect(sanitizeForLogs(null)).toBe(null);
      expect(sanitizeForLogs({})).toEqual({});
    });

    test('should handle carriage returns', () => {
      const result = sanitizeForLogs('Windows\r\nLine endings\r');
      expect(result).toBe('Windows  Line endings ');
    });
  });
});
