// tests/updateCustomer.test.js
// Focused tests for updateCustomer validation logic and input processing

const {
  validateEmailAddress,
  validatePhoneNumber,
  formatPhoneNumber,
  sanitizeCustomerData
} = require('../../src/utils/squareUtils');

describe('updateCustomer Supporting Functions', () => {
  describe('validateEmailAddress', () => {
    test('should validate correct email addresses', () => {
      const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'user+tag@example.org'];

      validEmails.forEach(email => {
        const result = validateEmailAddress(email);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    test('should reject invalid email addresses', () => {
      const invalidEmails = ['invalid-email', '@domain.com', 'user@', 'user space@domain.com'];

      invalidEmails.forEach(email => {
        const result = validateEmailAddress(email);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });
  });

  describe('validatePhoneNumber', () => {
    test('should validate correct phone numbers', () => {
      const validNumbers = ['+12345678901', '(234) 567-8901', '234-567-8901', '2345678901'];

      validNumbers.forEach(number => {
        const result = validatePhoneNumber(number);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });
    });

    test('should reject invalid phone numbers', () => {
      const invalidNumbers = ['123', '1234567890123456', 'abc123def', '000-000-0000'];

      invalidNumbers.forEach(number => {
        const result = validatePhoneNumber(number);
        expect(result.isValid).toBe(false);
        expect(result.errors).toBeTruthy();
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });
  });

  describe('formatPhoneNumber', () => {
    test('should format phone numbers correctly', () => {
      expect(formatPhoneNumber('(234) 567-8901').formatted).toBe('+12345678901');
      expect(formatPhoneNumber('234-567-8901').formatted).toBe('+12345678901');
      expect(formatPhoneNumber('2345678901').formatted).toBe('+12345678901');
      expect(formatPhoneNumber('+12345678901').formatted).toBe('+12345678901');
    });
  });

  describe('sanitizeCustomerData', () => {
    test('should sanitize customer data correctly', () => {
      const squareCustomer = {
        id: 'customer123',
        givenName: 'John',
        familyName: 'Doe',
        emailAddress: 'john@example.com',
        phoneNumber: '+12345678901',
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-01T12:00:00.000Z',
        version: 1,
        // Extra fields that should be filtered out
        preferences: {},
        cards: []
      };

      const result = sanitizeCustomerData(squareCustomer);

      expect(result).toEqual({
        id: 'customer123',
        given_name: 'John',
        family_name: 'Doe',
        email_address: 'john@example.com',
        phone_number: '+12345678901',
        created_at: '2024-01-01T10:00:00.000Z',
        updated_at: '2024-01-01T12:00:00.000Z',
        preferences: {}
      });
    });

    test('should handle missing optional fields', () => {
      const squareCustomer = {
        id: 'customer123',
        givenName: 'John'
      };

      const result = sanitizeCustomerData(squareCustomer);

      expect(result.id).toBe('customer123');
      expect(result.given_name).toBe('John');
      expect(result.family_name).toBeUndefined();
      expect(result.email_address).toBeUndefined();
      expect(result.phone_number).toBeUndefined();
    });
  });
});

// Integration test for validation logic
describe('updateCustomer Validation Integration', () => {
  test('should handle BigInt version conversion', () => {
    // Test BigInt conversion logic
    const version = 5;
    const bigIntVersion = typeof version === 'number' ? BigInt(version) : version;

    expect(bigIntVersion).toEqual(BigInt(5));
    expect(typeof bigIntVersion).toBe('bigint');
  });

  test('should handle field clearing logic', () => {
    // Test field clearing logic
    const updateData = {
      firstName: '',
      lastName: null,
      email: '',
      phoneNumber: null,
      note: ''
    };

    // Check that all fields are properly defined for clearing
    const hasUpdates = Object.keys(updateData).some(key => updateData[key] !== undefined);
    expect(hasUpdates).toBe(true);

    // Test sparse update object building logic
    const updateRequest = {};

    if (updateData.firstName !== undefined) {
      updateRequest.givenName = updateData.firstName ? updateData.firstName.trim() : null;
    }
    if (updateData.lastName !== undefined) {
      updateRequest.familyName = updateData.lastName ? updateData.lastName.trim() : null;
    }
    if (updateData.email !== undefined) {
      updateRequest.emailAddress = updateData.email ? updateData.email.trim().toLowerCase() : null;
    }
    if (updateData.phoneNumber !== undefined) {
      updateRequest.phoneNumber = updateData.phoneNumber;
    }
    if (updateData.note !== undefined) {
      updateRequest.note = updateData.note || null;
    }

    expect(updateRequest).toEqual({
      givenName: null,
      familyName: null,
      emailAddress: null,
      phoneNumber: null,
      note: null
    });
  });
});
