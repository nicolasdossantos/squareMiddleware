const {
  createBooking,
  updateBooking,
  cancelBooking: cancelBookingHelper,
  getBooking: getBookingHelper,
  getBookingsByCustomer: getBookingsByCustomerHelper
} = require('../utils/helpers/bookingHelpers');
const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
const { createSquareClient } = require('../utils/squareUtils');

class BookingService {
  /**
   * Create a new booking
   * @param {Object} tenant - Tenant context with credentials
   * @param {Object} bookingData - Booking data
   * @returns {Object} Created booking
   */
  async createBooking(tenant, bookingData) {
    console.log('BookingService.createBooking called with:', JSON.stringify(bookingData, null, 2));

    try {
      // Create mock Azure Functions context
      const context = {
        log: (...args) => console.log('[BOOKING]', ...args),
        error: (...args) => console.error('[BOOKING ERROR]', ...args),
        warn: (...args) => console.warn('[BOOKING WARN]', ...args),
        info: (...args) => console.info('[BOOKING INFO]', ...args)
      };

      // Call the helper with tenant context
      const result = await createBooking(context, tenant, bookingData);

      console.log('Booking helper returned:', result);

      return {
        success: true,
        data: {
          booking: cleanBigIntFromObject(result)
        }
      };
    } catch (error) {
      console.error('BookingService.createBooking error:', error);
      throw error;
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
    console.log('BookingService.updateBooking called with:', {
      bookingId,
      updateData: JSON.stringify(updateData, null, 2),
      correlationId
    });

    try {
      // Create mock Azure Functions context
      const context = {
        log: (...args) => console.log('[BOOKING UPDATE]', ...args),
        error: (...args) => console.error('[BOOKING UPDATE ERROR]', ...args),
        warn: (...args) => console.warn('[BOOKING UPDATE WARN]', ...args),
        info: (...args) => console.info('[BOOKING UPDATE INFO]', ...args)
      };

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

        console.log('Processed appointment segments:', processedUpdateData.appointmentSegments);
      }

      // Call the helper with tenant context
      const result = await updateBooking(context, tenant, bookingId, processedUpdateData);

      console.log('Booking update helper returned:', result);

      return {
        success: true,
        data: {
          id: bookingId,
          ...updateData,
          updatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('BookingService.updateBooking error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'UPDATE_FAILED'
      };
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
      const context = {
        log: (...args) => console.log('[BOOKING GET]', ...args),
        error: (...args) => console.error('[BOOKING GET ERROR]', ...args),
        warn: (...args) => console.warn('[BOOKING GET WARN]', ...args),
        info: (...args) => console.info('[BOOKING GET INFO]', ...args)
      };

      const result = await getBookingHelper(context, tenant, bookingId);

      return {
        success: true,
        data: {
          booking: cleanBigIntFromObject(result.booking)
        }
      };
    } catch (error) {
      console.error('BookingService.getBooking error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'GET_FAILED'
      };
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
      const square = createSquareClient(tenant.accessToken);

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
        undefined, // cursor (pagination)
        params.customerId, // customerId
        params.teamMemberId // teamMemberId
        // Omitting locationId, startAtMin, startAtMax to avoid validation errors
      );

      // Square SDK v42+ response structure
      const bookings = response.result?.bookings || [];

      return {
        success: true,
        data: {
          bookings: bookings.map(b => cleanBigIntFromObject(b)),
          total: bookings.length,
          cursor: response.result?.cursor
        }
      };
    } catch (error) {
      console.error('BookingService.listBookings error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'LIST_FAILED'
      };
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
      const context = {
        log: (...args) => console.log('[BOOKING CANCEL]', ...args),
        error: (...args) => console.error('[BOOKING CANCEL ERROR]', ...args),
        warn: (...args) => console.warn('[BOOKING CANCEL WARN]', ...args),
        info: (...args) => console.info('[BOOKING CANCEL INFO]', ...args)
      };

      const result = await cancelBookingHelper(context, tenant, bookingId);

      return {
        success: true,
        data: {
          booking: cleanBigIntFromObject(result)
        }
      };
    } catch (error) {
      console.error('BookingService.cancelBooking error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'CANCEL_FAILED'
      };
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
      const context = {
        log: (...args) => console.log('[BOOKING CUSTOMER]', ...args),
        error: (...args) => console.error('[BOOKING CUSTOMER ERROR]', ...args),
        warn: (...args) => console.warn('[BOOKING CUSTOMER WARN]', ...args),
        info: (...args) => console.info('[BOOKING CUSTOMER INFO]', ...args)
      };

      const result = await getBookingsByCustomerHelper(context, tenant, customerId);

      return {
        success: true,
        data: {
          bookings: Array.isArray(result) ? result.map(b => cleanBigIntFromObject(b)) : []
        }
      };
    } catch (error) {
      console.error('BookingService.getBookingsByCustomer error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'GET_CUSTOMER_BOOKINGS_FAILED'
      };
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
      const context = {
        log: (...args) => console.log('[BOOKING CONFIRM]', ...args),
        error: (...args) => console.error('[BOOKING CONFIRM ERROR]', ...args),
        warn: (...args) => console.warn('[BOOKING CONFIRM WARN]', ...args),
        info: (...args) => console.info('[BOOKING CONFIRM INFO]', ...args)
      };

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
      console.error('BookingService.confirmBooking error:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'CONFIRM_FAILED'
      };
    }
  }
}

module.exports = new BookingService();
