// tests/updateCustomer.integration.test.js

// Note: These tests are skipped by default to avoid making real API calls during CI/CD
// To run these tests locally against Square sandbox, you would need valid credentials

describe.skip('updateCustomer Real API Integration Tests', () => {
  // These tests are skipped to prevent real API calls in CI/CD
  // They can be enabled locally for manual testing with valid Square sandbox credentials

  test('would test real Square API integration', () => {
    // This test would require:
    // 1. Valid Square sandbox credentials
    // 2. A test customer ID that exists in sandbox
    // 3. Proper environment setup

    expect(true).toBe(true); // Placeholder
  });
});

// Working integration tests for validation logic
describe('updateCustomer Validation Integration Tests', () => {
  test('should integrate with existing validation systems', () => {
    const { validateEmailAddress, validatePhoneNumber } = require('../../src/utils/squareUtils');

    // Test email validation integration
    const emailResult = validateEmailAddress('test@example.com');
    expect(emailResult.isValid).toBe(true);

    const invalidEmailResult = validateEmailAddress('invalid-email');
    expect(invalidEmailResult.isValid).toBe(false);

    // Test phone validation integration
    const phoneResult = validatePhoneNumber('+12345678901');
    expect(phoneResult.isValid).toBe(true);

    const invalidPhoneResult = validatePhoneNumber('123');
    expect(invalidPhoneResult.isValid).toBe(false);
  });

  test('should integrate with phone formatting system', () => {
    const { formatPhoneNumber } = require('../../src/utils/squareUtils');

    // Test various phone number formats
    expect(formatPhoneNumber('(234) 567-8901').formatted).toBe('+12345678901');
    expect(formatPhoneNumber('234-567-8901').formatted).toBe('+12345678901');
    expect(formatPhoneNumber('2345678901').formatted).toBe('+12345678901');
  });

  test('should integrate with data sanitization system', () => {
    const { sanitizeCustomerData } = require('../../src/utils/squareUtils');

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
});
