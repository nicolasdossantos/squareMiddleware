/**
 * Tests for Log Redaction Utility
 * Verifies that sensitive data is properly redacted from logs
 */

const {
  redactValue,
  redactObject,
  redactJsonString,
  redactPayload,
  redactWebhookPayload,
  redactRequest
} = require('../../../src/utils/logRedactor');

describe('Log Redaction Utility', () => {
  describe('redactValue()', () => {
    test('should redact access tokens', () => {
      const token =
        'sq0atp_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890';
      const redacted = redactValue(token, 'accessToken');

      expect(redacted).toContain('[REDACTED]');
      expect(redacted).toContain('sq0atp'); // First 6 chars
      expect(redacted).not.toContain('1234567890'); // Middle hidden
    });

    test('should redact phone numbers', () => {
      const phone = '+1 (555) 123-4567';
      const redacted = redactValue(phone, 'phone');

      expect(redacted).toBe('XXX-XXX-4567');
    });

    test('should redact email addresses', () => {
      const email = 'user@example.com';
      const redacted = redactValue(email, 'email');

      expect(redacted).toBe('****@example.com');
    });

    test('should redact customer IDs', () => {
      const customerId = 'CUST_12345678';
      const redacted = redactValue(customerId, 'customerId');

      expect(redacted).toBe('[REDACTED_ID]');
    });

    test('should handle short tokens', () => {
      const shortToken = '12345';
      const redacted = redactValue(shortToken, 'token');

      expect(redacted).toBe('[REDACTED_TOKEN]');
    });
  });

  describe('redactObject()', () => {
    test('should redact sensitive fields in object', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        phoneNumber: '+1 (555) 123-4567',
        accessToken:
          'sq0atp_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890',
        apiKey: 'secret_key_123456789'
      };

      const redacted = redactObject(obj);

      expect(redacted.name).toBe('John Doe'); // Not redacted
      expect(redacted.email).toContain('****@');
      expect(redacted.phoneNumber).toContain('XXX-XXX-');
      expect(redacted.accessToken).toContain('[REDACTED]');
      expect(redacted.apiKey).toContain('[REDACTED]');
    });

    test('should recursively redact nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          credentials: {
            accessToken: 'sq0atp_secret',
            refreshToken: 'refresh_secret'
          }
        }
      };

      const redacted = redactObject(obj);

      expect(redacted.user.name).toBe('John');
      expect(redacted.user.credentials.accessToken).toContain('[REDACTED]');
      expect(redacted.user.credentials.refreshToken).toContain('[REDACTED]');
    });

    test('should redact arrays of objects', () => {
      const obj = {
        customers: [
          { name: 'Alice', email: 'alice@example.com', customerId: 'CUST_1' },
          { name: 'Bob', email: 'bob@example.com', customerId: 'CUST_2' }
        ]
      };

      const redacted = redactObject(obj);

      expect(redacted.customers[0].name).toBe('Alice');
      expect(redacted.customers[0].email).toContain('****@');
      expect(redacted.customers[0].customerId).toBe('[REDACTED_ID]');
      expect(redacted.customers[1].email).toContain('****@');
    });

    test('should not modify original object', () => {
      const obj = {
        email: 'test@example.com',
        accessToken: 'secret_token'
      };

      const original = JSON.parse(JSON.stringify(obj));
      const redacted = redactObject(obj);

      expect(obj).toEqual(original);
    });
  });

  describe('redactJsonString()', () => {
    test('should redact JSON strings', () => {
      const jsonString = JSON.stringify({
        email: 'user@example.com',
        accessToken: 'sq0atp_secret'
      });

      const redacted = redactJsonString(jsonString);
      const parsed = JSON.parse(redacted);

      expect(parsed.email).toContain('****@');
      expect(parsed.accessToken).toContain('[REDACTED]');
    });

    test('should handle invalid JSON gracefully', () => {
      const invalidJson = '{ invalid json }';
      const redacted = redactJsonString(invalidJson);

      expect(redacted).toBe(invalidJson);
    });
  });

  describe('redactWebhookPayload()', () => {
    test('should redact webhook payload while preserving event type', () => {
      const payload = {
        event: 'call_analyzed',
        data: {
          callId: 'call_12345',
          transcript: 'Customer said: My number is 555-123-4567',
          analysis: 'Customer provided their phone number'
        }
      };

      const redacted = redactWebhookPayload(payload);

      expect(redacted.event).toBe('call_analyzed');
      expect(redacted.data).toBeDefined();
      // Transcript and analysis are not specifically marked as sensitive, so they may or may not be redacted
      // depending on pattern matching
    });

    test('should handle webhook payload with null data', () => {
      const payload = {
        event: 'call_started',
        data: null
      };

      const redacted = redactWebhookPayload(payload);

      expect(redacted.event).toBe('call_started');
      // redactWebhookPayload returns undefined for null data (by design)
      expect(redacted.data).toBeUndefined();
    });
  });

  describe('redactPayload()', () => {
    test('should redact full request/response payloads', () => {
      const payload = {
        method: 'POST',
        email: 'user@example.com',
        phone: '+1 (555) 123-4567',
        accessToken: 'sq0atp_secret'
      };

      const redacted = redactPayload(payload);

      expect(redacted.method).toBe('POST');
      expect(redacted.email).toContain('****@');
      expect(redacted.phone).toContain('XXX-XXX-');
      expect(redacted.accessToken).toContain('[REDACTED]');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex real-world customer update payload', () => {
      const payload = {
        customerId: 'CUST_12345',
        squareAccessToken: 'sq0atp_1234567890abcdefghijklmnopqrstuvwxyz',
        squareLocationId: 'MEMPJYG33PH6Q',
        phone_number: '+1 (555) 987-6543',
        email_address: 'customer@business.com',
        notes: 'Customer called about appointment'
      };

      const redacted = redactPayload(payload);

      expect(redacted.customerId).toBe('[REDACTED_ID]');
      expect(redacted.squareAccessToken).toContain('[REDACTED]');
      // squareLocationId is an ID - redacted completely
      expect(redacted.squareLocationId).toBe('[REDACTED_ID]');
      expect(redacted.phone_number).toContain('XXX-XXX-');
      expect(redacted.email_address).toContain('****@');
      expect(redacted.notes).toBe('Customer called about appointment'); // Not sensitive
    });

    test('should handle tenant context with all credential types', () => {
      const tenant = {
        id: 'agent_1',
        agentId: 'agent_1',
        squareAccessToken: 'sq0atp_secret_access_token',
        squareRefreshToken: 'sq0app_secret_refresh_token',
        squareMerchantId: 'MERCHANT_123',
        squareLocationId: 'LOCATION_456',
        staffEmail: 'staff@company.com',
        bearerToken: 'bearer_token_xyz',
        supportsSellerLevelWrites: true
      };

      const redacted = redactPayload(tenant);

      // 'id' alone is not a sensitive field (must be agentId, customerId, etc.)
      expect(redacted.id).toBe('agent_1');
      expect(redacted.agentId).toBe('[REDACTED_ID]');
      expect(redacted.squareAccessToken).toContain('[REDACTED]');
      expect(redacted.squareRefreshToken).toContain('[REDACTED]');
      expect(redacted.squareMerchantId).toBe('[REDACTED_ID]');
      // squareLocationId is an ID - redacted completely
      expect(redacted.squareLocationId).toBe('[REDACTED_ID]');
      expect(redacted.staffEmail).toContain('****@');
      expect(redacted.supportsSellerLevelWrites).toBe(true); // Boolean not redacted
    });
  });
});
