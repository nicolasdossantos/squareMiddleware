/**
 * SMS Service Unit Tests (Simplified)
 * Tests for the SMS messaging service functionality
 */

const smsService = require('../../src/services/smsService');

describe('SMS Service (Core Functions)', () => {
  describe('validatePhoneNumber', () => {
    it('should validate correct E.164 phone numbers', () => {
      expect(smsService.validatePhoneNumber('+12677210098')).toBe(true);
      expect(smsService.validatePhoneNumber('+5511987654321')).toBe(true);
      expect(smsService.validatePhoneNumber('+12159324398')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(smsService.validatePhoneNumber('12677210098')).toBe(false); // Missing +
      expect(smsService.validatePhoneNumber('+0123456789')).toBe(false); // Starts with 0
      expect(smsService.validatePhoneNumber('invalid')).toBe(false);
      expect(smsService.validatePhoneNumber('')).toBe(false);
    });

    it('should handle whatsapp prefix in validation', () => {
      expect(smsService.validatePhoneNumber('whatsapp:+12677210098')).toBe(true);
      expect(smsService.validatePhoneNumber('whatsapp:+5511987654321')).toBe(true);
    });

    it('should handle null input gracefully', () => {
      expect(() => smsService.validatePhoneNumber(null)).toThrow();
    });
  });

  describe('formatPhoneNumber', () => {
    it('should remove whatsapp prefix', () => {
      expect(smsService.formatPhoneNumber('whatsapp:+12677210098')).toBe('+12677210098');
      expect(smsService.formatPhoneNumber('+12677210098')).toBe('+12677210098');
    });
  });
});
