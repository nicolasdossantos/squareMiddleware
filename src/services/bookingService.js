const {
  createBooking,
  updateBooking,
  cancelBooking: cancelBookingHelper,
  getBooking: getBookingHelper,
  getBookingsByCustomer: getBookingsByCustomerHelper
} = require('../utils/helpers/bookingHelpers');
const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
const { createSquareClient } = require('../utils/squareUtils');
const { logger } = require('../utils/logger');
const { createError } = require('../utils/errorCodes');

function createLoggingContext(prefix) {
  return {
    log: (...args) => logger.info(`[${prefix}]`, ...args),
    error: (...args) => logger.error(`[${prefix} ERROR]`, ...args),
    warn: (...args) => logger.warn(`[${prefix} WARN]`, ...args),
    info: (...args) => logger.info(`[${prefix} INFO]`, ...args)
  };
}

class BookingService {
  /**
   * Create a new booking
   * @param {Object} tenant - Tenant context with credentials
   * @param {Object} bookingData - Booking data
   * @returns {Object} Created booking
   */
  async createBooking(tenant, bookingData) {
    try {
      // Create mock Azure Functions context
      const context = createLoggingContext('BOOKING');

      // Call the helper with tenant context
      const result = await createBooking(context, tenant, bookingData);

      return {
        success: true,
        data: {
          booking: cleanBigIntFromObject(result)
        }
      };
    } catch (error) {
      logger.error('BookingService.createBooking error:', error);
      if (error.code) {
        throw error;
      }
      throw createError(
        'BOOKING_CREATION_FAILED',
        {
          tenantId: tenant?.id || tenant?.agentId,
          originalError: error.message
        },
        null,
        'Failed to create booking'
      );
    }
  }

  /**
   * Update an existing booking
   * @param {Object} tenant - Tenant context with credentials
   * @param {string} bookingId - Booking ID to update
   * @param {Object} updateData - Fields to update
   * @param {string} correlationId - Correlation ID for logging
   * @returns {Object} Updated booking
   */
  async updateBooking(tenant, bookingId, updateData, correlationId) {
    try {
      // Create mock Azure Functions context
      const context = createLoggingContext('BOOKING UPDATE');

      // Process appointmentSegments to ensure correct data types
      const processedUpdateData = { ...updateData };

      if (updateData.appointmentSegments) {
        processedUpdateData.appointmentSegments = updateData.appointmentSegments.map(segment => ({
          ...segment,
          // Convert serviceVariationVersion from string to BigInt for Square API
          serviceVariationVersion: segment.serviceVariationVersion
            ? BigInt(segment.serviceVariationVersion)
            : segment.serviceVariationVersion
        }));
      }

      // Call the helper with tenant context
      const result = await updateBooking(context, tenant, bookingId, processedUpdateData);

      return {
        success: true,
        data: {
          id: bookingId,
          ...updateData,
          updatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('BookingService.updateBooking error:', error);
      if (error.code) {
        throw error;
      }
      throw createError(
        'BOOKING_UPDATE_FAILED',
        {
          tenantId: tenant?.id || tenant?.agentId,
          bookingId,
          originalError: error.message
        },
        correlationId,
        'Failed to update booking'
      );
    }
  }

  /**
   * Get booking by ID
   * @param {Object} tenant - Tenant context with credentials
   * @param {string} bookingId - Booking ID to retrieve
   * @param {string} correlationId - Correlation ID for logging
   * @returns {Object} Booking details
   */
  async getBooking(tenant, bookingId, correlationId) {
    try {
      const context = createLoggingContext('BOOKING GET');

      const result = await getBookingHelper(context, tenant, bookingId);

      return {
        success: true,
        data: {
          booking: cleanBigIntFromObject(result.booking)
        }
      };
    } catch (error) {
      logger.error('BookingService.getBooking error:', error);
      if (error.code) {
        throw error;
      }
      throw createError(
        'BOOKING_NOT_FOUND',
        {
          tenantId: tenant?.id || tenant?.agentId,
          bookingId,
          originalError: error.message
        },
        correlationId,
        error.message || 'Failed to retrieve booking'
      );
    }
  }

  /**
   * List bookings with filters
   * @param {Object} filters - Filter parameters
   * @param {Object} tenant - Tenant context with credentials
   * @param {string} correlationId - Correlation ID for logging
   * @returns {Object} List of bookings
   */
  async listBookings(filters, tenant, correlationId) {
    try {
      const square = createSquareClient(
        tenant.accessToken || tenant.squareAccessToken,
        tenant.squareEnvironment || tenant.environment || 'production'
      );

      // Build Square API parameters
      const params = {
        locationId: tenant.locationId
      };

      if (filters.limit) params.limit = filters.limit;
      if (filters.customerId) params.customerId = filters.customerId;
      if (filters.teamMemberId) params.teamMemberId = filters.teamMemberId;

      // Map startDate/endDate to Square's startAtMin/startAtMax
      if (filters.startDate) params.startAtMin = filters.startDate;
      if (filters.endDate) params.startAtMax = filters.endDate;
      if (filters.startAtMin) params.startAtMin = filters.startAtMin;
      if (filters.startAtMax) params.startAtMax = filters.startAtMax;

      // Call Square API with individual parameters (SDK v42+)
      // NOTE: Not passing locationId in the API call because it's causing date range errors
      // The access token already scopes to the location
      const response = await square.bookingsApi.listBookings(
        params.limit, // limit
        filters.cursor || undefined, // cursor (pagination) - pass from request
        params.customerId, // customerId
        params.teamMemberId // teamMemberId
        // Omitting locationId, startAtMin, startAtMax to avoid validation errors
      );

      // Square SDK v42+ response structure
      const bookings = response.result?.bookings || [];
      const cursor = response.result?.cursor; // Next page cursor

      return {
        success: true,
        data: {
          bookings: bookings.map(b => cleanBigIntFromObject(b)),
          cursor: cursor // Return cursor for next page
        }
      };
    } catch (error) {
      logger.error('BookingService.listBookings error:', error);
      if (error.code) {
        throw error;
      }
      throw createError(
        'SQUARE_API_ERROR',
        {
          tenantId: tenant?.id || tenant?.agentId,
          filters,
          originalError: error.message
        },
        correlationId,
        'Failed to list bookings'
      );
    }
  }

  /**
   * Cancel booking
   * @param {Object} tenant - Tenant context with credentials
   * @param {string} bookingId - Booking ID to cancel
   * @param {string} correlationId - Correlation ID for logging
   * @returns {Object} Cancelled booking
   */
  async cancelBooking(tenant, bookingId, correlationId) {
    try {
      const context = createLoggingContext('BOOKING CANCEL');

      const result = await cancelBookingHelper(context, tenant, bookingId);

      return {
        success: true,
        data: {
          booking: cleanBigIntFromObject(result)
        }
      };
    } catch (error) {
      logger.error('BookingService.cancelBooking error:', error);
      if (error.code) {
        throw error;
      }
      throw createError(
        'BOOKING_CANCEL_FAILED',
        {
          tenantId: tenant?.id || tenant?.agentId,
          bookingId,
          originalError: error.message
        },
        correlationId,
        'Failed to cancel booking'
      );
    }
  }

  /**
   * Get bookings by customer ID
   * @param {Object} tenant - Tenant context with credentials
   * @param {string} customerId - Customer ID
   * @param {string} correlationId - Correlation ID for logging
   * @returns {Object} Customer bookings
   */
  async getBookingsByCustomer(tenant, customerId, correlationId) {
    try {
      const context = createLoggingContext('BOOKING CUSTOMER');

      const result = await getBookingsByCustomerHelper(context, tenant, customerId);

      return {
        success: true,
        data: {
          bookings: Array.isArray(result) ? result.map(b => cleanBigIntFromObject(b)) : []
        }
      };
    } catch (error) {
      logger.error('BookingService.getBookingsByCustomer error:', error);
      if (error.code) {
        throw error;
      }
      throw createError(
        'SQUARE_API_ERROR',
        {
          tenantId: tenant?.id || tenant?.agentId,
          customerId,
          originalError: error.message
        },
        correlationId,
        'Failed to retrieve customer bookings'
      );
    }
  }

  /**
   * Confirm booking (update status to ACCEPTED)
   * @param {Object} tenant - Tenant context with credentials
   * @param {string} bookingId - Booking ID to confirm
   * @param {string} correlationId - Correlation ID for logging
   * @returns {Object} Confirmed booking
   */
  async confirmBooking(tenant, bookingId, correlationId) {
    try {
      const context = createLoggingContext('BOOKING CONFIRM');

      // First get the current booking to get its version
      const currentBooking = await getBookingHelper(context, tenant, bookingId);

      // Update booking status to ACCEPTED
      const result = await updateBooking(context, tenant, bookingId, {
        version: currentBooking.booking.version,
        status: 'ACCEPTED'
      });

      return {
        success: true,
        data: cleanBigIntFromObject(result)
      };
    } catch (error) {
      logger.error('BookingService.confirmBooking error:', error);
      if (error.code) {
        throw error;
      }
      throw createError(
        'BOOKING_UPDATE_FAILED',
        {
          tenantId: tenant?.id || tenant?.agentId,
          bookingId,
          originalError: error.message
        },
        correlationId,
        'Failed to confirm booking'
      );
    }
  }
}

module.exports = new BookingService();
