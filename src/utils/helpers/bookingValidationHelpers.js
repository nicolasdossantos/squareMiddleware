/**
 * Booking Validation Helpers
 * Extracted from BookingController.createBookingCore
 *
 * Contains pre-creation validation logic:
 * - Slot availability verification
 * - Customer booking conflict detection
 */

const { logger } = require('../logger');
const { createSquareClient } = require('../squareUtils');
const { cleanBigIntFromObject } = require('./bigIntUtils');

/**
 * Check if the requested time slot is available
 * Searches Square API for available slots near the requested time
 * @param {Object} square - Square client instance
 * @param {Object} tenant - Tenant context with locationId
 * @param {string} startAt - Requested booking start time (ISO string)
 * @param {Array} appointmentSegments - Appointment segments with serviceVariationId
 * @returns {Object} { isAvailable: boolean, error: string|null, availableSlots: Array }
 */
async function checkSlotAvailability(square, tenant, startAt, appointmentSegments) {
  logger.info('🔍 [AVAILABILITY CHECK] Verifying slot is still available...', {
    startAt,
    appointmentSegments: appointmentSegments?.length
  });

  try {
    // Create segment filters for availability search
    const segmentFilters = appointmentSegments.map(segment => ({
      serviceVariationId: segment.serviceVariationId,
      ...(segment.teamMemberId && {
        teamMemberIdFilter: {
          any: [segment.teamMemberId]
        }
      })
    }));

    // Search for availability at the exact requested time (±30 minutes window)
    // Note: Square API requires minimum 1 hour range
    const requestedStartTime = new Date(startAt);
    const searchStart = new Date(requestedStartTime.getTime() - 30 * 60 * 1000);
    const searchEnd = new Date(requestedStartTime.getTime() + 30 * 60 * 1000);

    const availabilityResponse = await square.bookingsApi.searchAvailability({
      query: {
        filter: {
          startAtRange: {
            startAt: searchStart.toISOString(),
            endAt: searchEnd.toISOString()
          },
          locationId: tenant.locationId,
          segmentFilters
        }
      }
    });

    // Square returns availabilities array directly in result
    const availableSlots =
      availabilityResponse.result?.availabilities || availabilityResponse.availabilities || [];

    logger.info('🔍 [AVAILABILITY CHECK] Square API response:', {
      availableSlotsCount: availableSlots.length,
      availableSlotTimes: availableSlots.slice(0, 5).map(s => s.startAt)
    });

    // Check if the exact requested time slot is available
    const isSlotAvailable = availableSlots.some(slot => {
      const slotStartTime = new Date(slot.startAt);
      const timeDifference = Math.abs(slotStartTime.getTime() - requestedStartTime.getTime());

      // Consider it the same slot if within 1 minute
      return timeDifference < 60 * 1000;
    });

    if (!isSlotAvailable) {
      logger.info('❌ [AVAILABILITY CHECK] Requested time slot is no longer available:', {
        requestedTime: startAt,
        availableSlotsFound: availableSlots.length,
        sampleSlots: availableSlots.slice(0, 3).map(s => s.startAt)
      });

      return {
        isAvailable: false,
        error: 'The requested time slot is no longer available. Please select a different time.',
        code: 'SLOT_UNAVAILABLE',
        availableSlots: availableSlots.slice(0, 10).map(s => ({
          startAt: s.startAt,
          appointmentSegments: s.appointmentSegments
        }))
      };
    }

    logger.info('✅ [AVAILABILITY CHECK] Time slot is still available', { startAt });
    return {
      isAvailable: true,
      error: null,
      code: null,
      availableSlots: []
    };
  } catch (error) {
    // Don't fail the booking creation if availability check fails
    // The Square API will reject it if truly unavailable
    logger.error('⚠️ [AVAILABILITY CHECK] Error checking slot availability:', error.message);
    logger.error('⚠️ [AVAILABILITY CHECK] Full error details:', {
      message: error.message,
      stack: error.stack
    });

    return {
      isAvailable: true, // Assume available on error to allow booking
      error: null,
      code: null,
      availableSlots: [],
      warning: 'Availability check failed but booking will proceed'
    };
  }
}

/**
 * Check for customer booking conflicts
 * Verifies customer doesn't already have a booking at the requested time
 * @param {Object} square - Square client instance
 * @param {string} customerId - Customer Square ID
 * @param {string} startAt - Requested booking start time (ISO string)
 * @returns {Object} { hasConflict: boolean, error: string|null, conflictingBookings: Array }
 */
async function checkCustomerConflicts(square, customerId, startAt) {
  logger.info('🔍 [CONFLICT CHECK] Checking for customer booking conflicts...', {
    customerId,
    startAt
  });

  try {
    // Get customer's existing bookings around the requested time (±30 minutes)
    const bufferMinutes = 30;
    const requestedStartTime = new Date(startAt);
    const searchStart = new Date(requestedStartTime.getTime() - bufferMinutes * 60 * 1000);
    const searchEnd = new Date(requestedStartTime.getTime() + bufferMinutes * 60 * 1000);

    const existingBookingsResponse = await square.bookingsApi.listBookings({
      customerId,
      startAtMin: searchStart.toISOString(),
      startAtMax: searchEnd.toISOString(),
      limit: 20
    });

    const existingBookings = existingBookingsResponse.result?.bookings || [];

    logger.info('🔍 [CONFLICT CHECK] Found existing bookings:', {
      count: existingBookings.length,
      bookings: existingBookings.map(b => ({
        id: b.id,
        startAt: b.startAt,
        status: b.status
      }))
    });

    // Check for conflicts with ACCEPTED or PENDING bookings
    const conflictingBookings = existingBookings.filter(booking => {
      if (booking.status !== 'ACCEPTED' && booking.status !== 'PENDING') {
        return false; // Skip cancelled/completed bookings
      }

      const bookingStart = new Date(booking.startAt);
      const timeDifference = Math.abs(bookingStart.getTime() - requestedStartTime.getTime());

      // Consider it a conflict if within 15 minutes
      return timeDifference < 15 * 60 * 1000;
    });

    if (conflictingBookings.length > 0) {
      logger.info('❌ [CONFLICT CHECK] Customer already has a booking at this time:', {
        requestedTime: startAt,
        conflictingBookings: conflictingBookings.map(b => ({
          id: b.id,
          startAt: b.startAt,
          status: b.status
        }))
      });

      return {
        hasConflict: true,
        error: 'Customer already has an appointment at this time. Please select a different time slot.',
        code: 'BOOKING_CONFLICT',
        conflictingBookings: cleanBigIntFromObject(
          conflictingBookings.map(b => ({
            id: b.id,
            startAt: b.startAt,
            status: b.status
          }))
        )
      };
    }

    logger.info('✅ [CONFLICT CHECK] No customer booking conflicts found');
    return {
      hasConflict: false,
      error: null,
      code: null,
      conflictingBookings: []
    };
  } catch (error) {
    // Don't fail the booking creation if conflict check fails
    logger.error('⚠️ [CONFLICT CHECK] Error checking customer conflicts:', error.message);

    return {
      hasConflict: false, // Assume no conflict on error to allow booking
      error: null,
      code: null,
      conflictingBookings: [],
      warning: 'Conflict check failed but booking will proceed'
    };
  }
}

module.exports = {
  checkSlotAvailability,
  checkCustomerConflicts
};
