// tests/customerBooking.test.js
const { validatePhoneNumber } = require('../../src/utils/squareUtils');
const { validateBookingData } = require('../../src/utils/helpers/bookingHelpers');

const { sanitizePhoneNumber, sanitizeInput } = require('../../src/utils/security');

describe('Customer Management', () => {
  describe('validatePhoneNumber', () => {
    test('should validate correct US phone numbers', () => {
      const validNumbers = ['+12345678901', '(234) 567-8901', '234-567-8901', '2345678901', '1-234-567-8901'];

      validNumbers.forEach(number => {
        const result = validatePhoneNumber(number);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });
    });

    test('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '',
        null,
        undefined,
        '123',
        '1234567890123456', // too long
        'abc123def',
        '000-000-0000',
        '111-111-1111'
      ];

      invalidNumbers.forEach(number => {
        const result = validatePhoneNumber(number);
        expect(result.isValid).toBe(false);
        expect(result.errors).toBeTruthy();
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });
  });

  describe('validateBookingData', () => {
    test('should validate complete booking data', () => {
      const validBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
        customerNote: 'Test booking',
        sellerNote: 'Internal note',
        customerId: 'customer123'
      };

      const result = validateBookingData(validBooking);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    test('should validate booking with customer information instead of customerId', () => {
      const validBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
        customerNote: 'Test booking',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '+12345678901'
      };

      const result = validateBookingData(validBooking);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    test('should reject incomplete booking data', () => {
      const incompleteBooking = {
        customerNote: 'Test booking'
      };

      const result = validateBookingData(incompleteBooking);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('appointmentSegments is required and must be an array');
      expect(result.errors).toContain('startAt timestamp is required');
      expect(result.errors).toContain(
        'Either customerId or customer information (firstName, lastName, email, phoneNumber) is required'
      );
    });

    test('should validate partial updates', () => {
      const partialUpdate = {
        customerNote: 'Updated note'
      };

      const result = validateBookingData(partialUpdate, true);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    test('should reject past timestamps', () => {
      const pastBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        startAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
        customerId: 'customer123'
      };

      const result = validateBookingData(pastBooking);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('startAt cannot be in the past');
    });

    test('should validate appointment segments structure', () => {
      const invalidSegments = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123'
            // missing teamMemberId and serviceVariationVersion
          }
        ],
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customerId: 'customer123'
      };

      const result = validateBookingData(invalidSegments);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('appointmentSegments[0].teamMemberId is required');
      expect(result.errors).toContain('appointmentSegments[0].serviceVariationVersion is required');
    });
  });
});

describe('Security Input Sanitization', () => {
  describe('sanitizePhoneNumber', () => {
    test('should sanitize phone numbers while preserving valid characters', () => {
      expect(sanitizePhoneNumber('+1 (234) 567-8901')).toBe('+1 (234) 567-8901');
      expect(sanitizePhoneNumber('234.567.8901')).toBe('234.567.8901');
      expect(sanitizePhoneNumber('2345678901')).toBe('2345678901');
    });

    test('should remove dangerous characters', () => {
      expect(sanitizePhoneNumber('234<script>567</script>8901')).toBe('2345678901');
      expect(sanitizePhoneNumber('234"567\'8901')).toBe('2345678901');
      expect(sanitizePhoneNumber('234&567&8901')).toBe('2345678901');
    });

    test('should handle non-string input', () => {
      expect(sanitizePhoneNumber(null)).toBe('');
      expect(sanitizePhoneNumber(undefined)).toBe('');
      expect(sanitizePhoneNumber(123)).toBe('');
    });
  });

  describe('sanitizeInput', () => {
    test('should sanitize general text input', () => {
      expect(sanitizeInput('Hello World')).toBe('Hello World');
      expect(sanitizeInput('  trimmed  ')).toBe('trimmed');
    });

    test('should remove XSS characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalertxssscript');
      expect(sanitizeInput('test"value\'here')).toBe('testvaluehere');
      expect(sanitizeInput('test&amp;value')).toBe('testamp;value');
    });

    test('should remove control characters', () => {
      expect(sanitizeInput('test\x00value')).toBe('testvalue');
      expect(sanitizeInput('test\nvalue')).toBe('testvalue');
      expect(sanitizeInput('test\tvalue')).toBe('testvalue');
    });

    test('should handle non-string input', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
      expect(sanitizeInput({ key: 'value' })).toEqual({ key: 'value' });
    });
  });
});

// Note: Integration tests for Square SDK functions would require actual API credentials
// and should be run against Square's sandbox environment
describe('Square SDK Integration (Mock Tests)', () => {
  // These tests would normally mock the Square SDK responses
  test('should be implemented with proper mocking for CI/CD', () => {
    // TODO: Implement proper mocks for Square SDK
    expect(true).toBe(true);
  });
});
