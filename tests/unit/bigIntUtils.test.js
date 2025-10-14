/**
 * Tests for BigInt utilities
 * Testing centralized BigInt conversion, serialization, and formatting
 */

const {
  bigIntToString,
  toBigInt,
  bigIntReplacer,
  cleanBigIntFromObject,
  convertBigIntsToStrings,
  formatPrice,
  durationToMinutes
} = require('../../src/utils/helpers/bigIntUtils');

describe('BigInt Utils', () => {
  describe('bigIntToString', () => {
    test('should convert BigInt to string', () => {
      expect(bigIntToString(BigInt(123))).toBe('123');
      expect(bigIntToString(BigInt(0))).toBe('0');
      expect(bigIntToString(BigInt(-456))).toBe('-456');
    });

    test('should handle non-BigInt values', () => {
      expect(bigIntToString('123')).toBe('123');
      expect(bigIntToString(456)).toBe('456');
      expect(bigIntToString('test')).toBe('test');
    });

    test('should handle null and undefined', () => {
      expect(bigIntToString(null)).toBe('0');
      expect(bigIntToString(undefined)).toBe('0');
    });
  });

  describe('toBigInt', () => {
    test('should convert number to BigInt', () => {
      expect(toBigInt(123)).toBe(BigInt(123));
      expect(toBigInt(0)).toBe(BigInt(0));
      expect(toBigInt(-456)).toBe(BigInt(-456));
    });

    test('should handle string numbers', () => {
      expect(toBigInt('123')).toBe(BigInt(123));
      expect(toBigInt('0')).toBe(BigInt(0));
      expect(toBigInt('-456')).toBe(BigInt(-456));
    });

    test('should pass through BigInt values', () => {
      const bigIntVal = BigInt(789);
      expect(toBigInt(bigIntVal)).toBe(bigIntVal);
    });

    test('should throw error for invalid values', () => {
      expect(() => toBigInt('invalid')).toThrow();
      expect(() => toBigInt({})).toThrow('Cannot convert object to BigInt');
      expect(() => toBigInt([])).toThrow('Cannot convert object to BigInt');
      expect(() => toBigInt(null)).toThrow('Cannot convert object to BigInt');
    });
  });

  describe('bigIntReplacer', () => {
    test('should convert BigInt values to strings', () => {
      expect(bigIntReplacer('key', BigInt(123))).toBe('123');
      expect(bigIntReplacer('key', BigInt(0))).toBe('0');
      expect(bigIntReplacer('key', BigInt(-456))).toBe('-456');
    });

    test('should pass through non-BigInt values', () => {
      expect(bigIntReplacer('key', 'string')).toBe('string');
      expect(bigIntReplacer('key', 123)).toBe(123);
      expect(bigIntReplacer('key', null)).toBe(null);
      expect(bigIntReplacer('key', { test: 'object' })).toEqual({ test: 'object' });
    });
  });

  describe('cleanBigIntFromObject', () => {
    test('should clean BigInt from simple values', () => {
      expect(cleanBigIntFromObject(BigInt(123))).toBe('123');
      expect(cleanBigIntFromObject('string')).toBe('string');
      expect(cleanBigIntFromObject(123)).toBe(123);
      expect(cleanBigIntFromObject(null)).toBe(null);
    });

    test('should clean BigInt from arrays', () => {
      const input = [BigInt(123), 'string', 456, BigInt(789)];
      const expected = ['123', 'string', 456, '789'];
      expect(cleanBigIntFromObject(input)).toEqual(expected);
    });

    test('should clean BigInt from nested arrays', () => {
      const input = [BigInt(123), [BigInt(456), 'nested'], 'string'];
      const expected = ['123', ['456', 'nested'], 'string'];
      expect(cleanBigIntFromObject(input)).toEqual(expected);
    });

    test('should clean BigInt from objects', () => {
      const input = {
        id: BigInt(123),
        name: 'test',
        price: BigInt(4500),
        count: 10
      };
      const expected = {
        id: '123',
        name: 'test',
        price: '4500',
        count: 10
      };
      expect(cleanBigIntFromObject(input)).toEqual(expected);
    });

    test('should clean BigInt from nested objects', () => {
      const input = {
        booking: {
          id: BigInt(123),
          segments: [
            { serviceId: BigInt(456), price: BigInt(3000) },
            { serviceId: BigInt(789), price: BigInt(2500) }
          ]
        },
        customer: {
          id: BigInt(111),
          name: 'John Doe'
        }
      };
      const expected = {
        booking: {
          id: '123',
          segments: [
            { serviceId: '456', price: '3000' },
            { serviceId: '789', price: '2500' }
          ]
        },
        customer: {
          id: '111',
          name: 'John Doe'
        }
      };
      expect(cleanBigIntFromObject(input)).toEqual(expected);
    });
  });

  describe('convertBigIntsToStrings', () => {
    test('should convert object with BigInt values', () => {
      const input = {
        id: BigInt(123),
        nested: {
          price: BigInt(4500),
          name: 'service'
        }
      };
      const result = convertBigIntsToStrings(input);
      expect(result.id).toBe('123');
      expect(result.nested.price).toBe('4500');
      expect(result.nested.name).toBe('service');
    });

    test('should handle arrays with BigInt values', () => {
      const input = [BigInt(123), { price: BigInt(4500) }];
      const result = convertBigIntsToStrings(input);
      expect(result[0]).toBe('123');
      expect(result[1].price).toBe('4500');
    });
  });

  describe('formatPrice', () => {
    test('should format BigInt prices correctly', () => {
      expect(formatPrice(BigInt(4500))).toBe('$45.00');
      expect(formatPrice(BigInt(1000))).toBe('$10.00');
      expect(formatPrice(BigInt(2550))).toBe('$25.50');
      expect(formatPrice(BigInt(0))).toBe('$0.00');
    });

    test('should format number prices correctly', () => {
      expect(formatPrice(4500)).toBe('$45.00');
      expect(formatPrice(1000)).toBe('$10.00');
      expect(formatPrice(2550)).toBe('$25.50');
      expect(formatPrice(0)).toBe('$0.00');
    });

    test('should format string prices correctly', () => {
      expect(formatPrice('4500')).toBe('$45.00');
      expect(formatPrice('1000')).toBe('$10.00');
      expect(formatPrice('2550')).toBe('$25.50');
      expect(formatPrice('0')).toBe('$0.00');
    });

    test('should handle null/undefined prices', () => {
      expect(formatPrice(null)).toBe('$0.00');
      expect(formatPrice(undefined)).toBe('$0.00');
      expect(formatPrice('')).toBe('$0.00');
    });

    test('should handle fractional cents', () => {
      expect(formatPrice(4599)).toBe('$45.99');
      expect(formatPrice(4501)).toBe('$45.01');
    });
  });

  describe('durationToMinutes', () => {
    test('should convert BigInt durations correctly', () => {
      expect(durationToMinutes(BigInt(60000))).toBe(1); // 1 minute
      expect(durationToMinutes(BigInt(1800000))).toBe(30); // 30 minutes
      expect(durationToMinutes(BigInt(3600000))).toBe(60); // 60 minutes
      expect(durationToMinutes(BigInt(0))).toBe(0);
    });

    test('should convert number durations correctly', () => {
      expect(durationToMinutes(60000)).toBe(1);
      expect(durationToMinutes(1800000)).toBe(30);
      expect(durationToMinutes(3600000)).toBe(60);
      expect(durationToMinutes(0)).toBe(0);
    });

    test('should convert string durations correctly', () => {
      expect(durationToMinutes('60000')).toBe(1);
      expect(durationToMinutes('1800000')).toBe(30);
      expect(durationToMinutes('3600000')).toBe(60);
      expect(durationToMinutes('0')).toBe(0);
    });

    test('should handle null/undefined durations', () => {
      expect(durationToMinutes(null)).toBe(0);
      expect(durationToMinutes(undefined)).toBe(0);
      expect(durationToMinutes('')).toBe(0);
    });

    test('should round to nearest minute', () => {
      expect(durationToMinutes(89999)).toBe(1); // 1.49 minutes -> 1
      expect(durationToMinutes(90000)).toBe(2); // 1.5 minutes -> 2
      expect(durationToMinutes(150000)).toBe(3); // 2.5 minutes -> 3
    });

    test('should handle fractional milliseconds', () => {
      expect(durationToMinutes(1799999)).toBe(30); // 29.99 minutes -> 30
      expect(durationToMinutes(1800001)).toBe(30); // 30.00 minutes -> 30
    });
  });
});
