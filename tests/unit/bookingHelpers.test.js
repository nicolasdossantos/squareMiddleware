// tests/helpers/bookingHelpers.test.js

const { validateBookingData } = require('../../src/utils/helpers/bookingHelpers');

describe('BookingHelpers', () => {
  describe('validateBookingData', () => {
    test('should validate complete booking data successfully', () => {
      const validBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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

    test('should reject booking without customer info', () => {
      const invalidBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customerNote: 'Test booking'
      };

      const result = validateBookingData(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Either customerId or customer information (firstName, lastName, email, phoneNumber) is required'
      );
    });

    test('should reject invalid booking data object', () => {
      const result = validateBookingData(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Booking data must be a valid object');
    });

    test('should reject missing appointmentSegments', () => {
      const invalidBooking = {
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customerId: 'customer123'
      };

      const result = validateBookingData(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('appointmentSegments is required and must be an array');
    });

    test('should reject non-array appointmentSegments', () => {
      const invalidBooking = {
        appointmentSegments: 'not an array',
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customerId: 'customer123'
      };

      const result = validateBookingData(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('appointmentSegments is required and must be an array');
    });

    test('should validate appointmentSegments structure', () => {
      const invalidBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123'
          }
        ],
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customerId: 'customer123'
      };

      const result = validateBookingData(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('appointmentSegments[0].teamMemberId is required');
      expect(result.errors).toContain('appointmentSegments[0].serviceVariationVersion is required');
      expect(result.errors).toContain('appointmentSegments[0].durationMinutes is required');
    });

    test('should reject missing startAt for new bookings', () => {
      const invalidBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        customerId: 'customer123'
      };

      const result = validateBookingData(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('startAt timestamp is required');
    });

    test('should reject invalid timestamp format', () => {
      const invalidBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        startAt: 'invalid-date',
        customerId: 'customer123'
      };

      const result = validateBookingData(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('startAt must be a valid ISO 8601 timestamp');
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
        startAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        customerId: 'customer123'
      };

      const result = validateBookingData(pastBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('startAt cannot be in the past');
    });

    test('should allow partial updates when isPartialUpdate is true', () => {
      const partialUpdate = {
        customerNote: 'Updated note'
      };

      const result = validateBookingData(partialUpdate, true);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    test('should validate customer note type', () => {
      const invalidBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customerNote: 123,
        customerId: 'customer123'
      };

      const result = validateBookingData(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('customerNote must be a string');
    });

    test('should validate seller note type', () => {
      const invalidBooking = {
        appointmentSegments: [
          {
            serviceVariationId: 'service123',
            teamMemberId: 'team456',
            serviceVariationVersion: 1,
            durationMinutes: 30
          }
        ],
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        sellerNote: 123,
        customerId: 'customer123'
      };

      const result = validateBookingData(invalidBooking);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sellerNote must be a string');
    });
  });

  // Note: Integration tests for actual booking operations require proper Square SDK setup
  // and should be tested against Square's sandbox environment in integration tests
  describe('Integration Test Placeholders', () => {
    test('createBooking function exists and can be imported', () => {
      const { createBooking } = require('../../src/utils/helpers/bookingHelpers');
      expect(typeof createBooking).toBe('function');
    });

    test('updateBooking function exists and can be imported', () => {
      const { updateBooking } = require('../../src/utils/helpers/bookingHelpers');
      expect(typeof updateBooking).toBe('function');
    });

    test('cancelBooking function exists and can be imported', () => {
      const { cancelBooking } = require('../../src/utils/helpers/bookingHelpers');
      expect(typeof cancelBooking).toBe('function');
    });

    test('getBooking function exists and can be imported', () => {
      const { getBooking } = require('../../src/utils/helpers/bookingHelpers');
      expect(typeof getBooking).toBe('function');
    });

    test('getActiveBookingsByCustomer function exists and can be imported', () => {
      const { getActiveBookingsByCustomer } = require('../../src/utils/helpers/bookingHelpers');
      expect(typeof getActiveBookingsByCustomer).toBe('function');
    });

    test('getAllBookingsByCustomer function exists and can be imported', () => {
      const { getAllBookingsByCustomer } = require('../../src/utils/helpers/bookingHelpers');
      expect(typeof getAllBookingsByCustomer).toBe('function');
    });
  });
});
