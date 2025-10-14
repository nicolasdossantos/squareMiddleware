const { createBooking, updateBooking } = require('../utils/helpers/bookingHelpers');
const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');

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
}

module.exports = new BookingService();
