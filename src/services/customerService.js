/**
 * Customer Service
 * Business logic for customer operations and Square API integration
 * Multi-tenant enabled - uses tenant context for all Square operations
 */

const { logger, logPerformance, logEvent, logError } = require('../utils/logger');
const { cleanBigIntFromObject, bigIntReplacer } = require('../utils/helpers/bigIntUtils');
const {
  createSquareClient,
  searchCustomerByPhone,
  loadServiceVariations,
  loadStaffMembers,
  formatPhoneNumber,
  updateCustomer
} = require('../utils/squareUtils');
const bookingService = require('./bookingService');

/**
 * Get customer information with integrated booking data
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} phoneNumber - Customer phone number
 * @returns {Object} Customer info with services and staff members
 */
async function getCustomerInfo(tenant, phoneNumber) {
  const startTime = Date.now();

  try {
    logger.info('🔍 Searching for customer by phone', { phoneNumber, type: typeof phoneNumber });

    // Validate phone number before calling shared function
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error(`Invalid phone number parameter: ${phoneNumber} (type: ${typeof phoneNumber})`);
    }

    // Smart format the phone number before searching
    const formatResult = formatPhoneNumber(phoneNumber);
    let searchPhone = phoneNumber; // Default to original if formatting fails

    if (formatResult.isValid) {
      searchPhone = formatResult.formatted;
      logger.info('📞 Phone number formatted', {
        original: formatResult.original,
        formatted: formatResult.formatted
      });
    } else {
      logger.warn('⚠️ Phone number formatting failed, using original', {
        phoneNumber,
        error: formatResult.error
      });
    }

    // Use the exact same logic as Azure Functions - delegate to shared utilities
    const customer = await searchCustomerByPhone(
      { log: logger.info.bind(logger) }, // Mock context for shared function
      tenant,
      searchPhone
    );

    if (!customer) {
      logger.info('No customer found for phone number', { phoneNumber });
    } else {
      logger.info('Customer found', {
        customerId: customer.id,
        name: `${customer.givenName || ''} ${customer.familyName || ''}`.trim()
      });
    }

    // Load services and staff members data in parallel (matching Azure Functions)
    const [servicesData, staffData] = await Promise.all([
      loadServiceVariations({ log: logger.info.bind(logger) }, tenant),
      loadStaffMembers({ log: logger.info.bind(logger) }, tenant)
    ]);

    // Build response with the same structure as Azure Functions
    const response = {
      // Wrap customer data in a customer object (for compatibility)
      customer: customer
        ? {
            ...cleanBigIntFromObject(customer),
            // Ensure camelCase field names for compatibility
            givenName: customer.given_name || customer.givenName,
            familyName: customer.family_name || customer.familyName,
            emailAddress: customer.email_address || customer.emailAddress,
            phoneNumber: customer.phone_number || customer.phoneNumber
          }
        : null,

      // Service and staff member data (matching Azure Functions response format)
      service_variations_json: JSON.stringify(servicesData.services || [], bigIntReplacer),
      staff_members_with_ids_json: JSON.stringify(staffData.staffMembers || [], bigIntReplacer),

      // Backward compatibility - deprecated field names
      barbers_with_ids_json: JSON.stringify(staffData.staffMembers || [], bigIntReplacer),

      // Arrays for test compatibility (clean BigInt values)
      services: cleanBigIntFromObject(servicesData.services || []),
      staffMembers: cleanBigIntFromObject(staffData.staffMembers || []),
      barbers: cleanBigIntFromObject(staffData.staffMembers || []), // Backward compatibility

      // Simple lists for AI readability (matching Azure Functions format)
      availableServices: (servicesData.services || []).map(s => s.name).join(', '),
      availableStaffMembers: (staffData.staffMembers || [])
        .map(m => {
          const firstName = m.firstName || '';
          if (firstName.toLowerCase() === 'wariton') return 'Junior';
          return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        })
        .join(', '),
      availableBarbers: (staffData.staffMembers || []) // Backward compatibility
        .map(m => {
          const firstName = m.firstName || '';
          if (firstName.toLowerCase() === 'wariton') return 'Junior';
          return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        })
        .join(', '),

      // Additional metadata
      is_returning_customer: !!customer,
      current_datetime_store_timezone: new Date().toLocaleString('en-US', {
        timeZone: tenant.timezone || 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    };

    const duration = Date.now() - startTime;

    logEvent('customer_service_get_customer_success', {
      phoneNumber,
      customerId: customer?.id,
      duration,
      servicesCount: servicesData.services?.length || 0,
      staffMembersCount: staffData.staffMembers?.length || 0,
      tenantId: tenant.id
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error getting customer info:', error);

    logEvent('customer_service_get_customer_error', {
      phoneNumber,
      error: error.message,
      duration
    });

    throw {
      message: error.message || 'Failed to get customer info',
      code: error.code || 'GET_CUSTOMER_ERROR',
      status: error.status || error.statusCode || 500
    };
  }
}

/**
 * Update customer information
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID to update
 * @param {Object} updateData - Fields to update
 * @returns {Object} Updated customer data
 */
async function updateCustomerInfo(tenant, customerId, updateData) {
  const startTime = Date.now();

  try {
    logEvent('customer_service_update_start', {
      customerId,
      updateFields: Object.keys(updateData),
      tenantId: tenant.id
    });

    // Field mapping for better UX - accept common field names
    const fieldMapping = {
      email: 'emailAddress',
      phone: 'phoneNumber',
      firstName: 'givenName',
      lastName: 'familyName',
      company: 'companyName'
    };

    // Apply field mapping to incoming data
    const mappedData = {};
    for (const [key, value] of Object.entries(updateData)) {
      const mappedKey = fieldMapping[key] || key;
      mappedData[mappedKey] = value;
    }

    // Validate allowed fields
    const allowedFields = [
      'givenName',
      'familyName',
      'companyName',
      'nickname',
      'emailAddress',
      'phoneNumber',
      'note',
      'preferences'
    ];

    const sanitizedData = {};
    for (const [key, value] of Object.entries(mappedData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        sanitizedData[key] = value;
      }
    }

    if (Object.keys(sanitizedData).length === 0) {
      throw new Error('No valid fields provided for update');
    }

    logger.debug('Updating customer with data:', {
      customerId,
      updateFields: Object.keys(sanitizedData)
    });

    // Use the squareUtils updateCustomer function
    const context = { log: logger.info.bind(logger), error: logger.error.bind(logger) };
    const updatedCustomer = await updateCustomer(context, tenant, customerId, sanitizedData);

    logPerformance(null, 'customer_service_update', startTime, {
      customerId,
      updatedFields: Object.keys(sanitizedData),
      tenantId: tenant.id
    });

    logEvent('customer_service_update_success', {
      customerId,
      updatedFields: Object.keys(sanitizedData),
      tenantId: tenant.id
    });

    // Clean BigInt values before returning
    return cleanBigIntFromObject(updatedCustomer);
  } catch (error) {
    logError(error, {
      operation: 'updateCustomerInfo',
      customerId,
      duration: Date.now() - startTime
    });

    if (error.message && error.message.includes('NOT_FOUND')) {
      throw {
        message: 'Customer not found',
        code: 'NOT_FOUND',
        status: 404
      };
    }

    throw {
      message: `Failed to update customer information: ${error.message || 'Unknown error'}`,
      code: error.code || 'UPDATE_ERROR',
      status: error.status || error.statusCode || 500
    };
  }
}

/**
 * Get customer bookings with filtering options
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID
 * @param {Object} options - Filter options
 * @returns {Array} Customer bookings
 */
async function getCustomerBookings(tenant, customerId, options = {}) {
  const startTime = Date.now();

  try {
    logEvent('customer_service_get_bookings_start', {
      customerId,
      options,
      tenantId: tenant.id
    });

    const bookings = await bookingService.getCustomerBookings(tenant, customerId, options);

    logPerformance(null, 'customer_service_get_bookings', startTime, {
      customerId,
      bookingsCount: bookings.length,
      tenantId: tenant.id
    });

    return bookings;
  } catch (error) {
    logError(error, {
      operation: 'getCustomerBookings',
      customerId,
      duration: Date.now() - startTime,
      tenantId: tenant.id
    });
    throw {
      message: `Failed to retrieve customer bookings: ${error.message || 'Unknown error'}`,
      code: error.code || 'GET_BOOKINGS_ERROR',
      status: error.status || error.statusCode || 500
    };
  }
}

/**
 * Create booking for customer
 * @param {Object} tenant - Tenant context with credentials
 * @param {Object} bookingData - Booking data
 * @returns {Object} Created booking
 */
async function createBooking(tenant, bookingData) {
  const startTime = Date.now();

  try {
    logEvent('customer_service_create_booking_start', {
      customerId: bookingData.customerId,
      serviceId: bookingData.serviceId,
      tenantId: tenant.id
    });

    const booking = await bookingService.createBooking(tenant, bookingData);

    logPerformance(null, 'customer_service_create_booking', startTime, {
      customerId: bookingData.customerId,
      bookingId: booking.id,
      tenantId: tenant.id
    });

    return booking;
  } catch (error) {
    logError(error, {
      operation: 'createBooking',
      customerId: bookingData.customerId,
      duration: Date.now() - startTime,
      tenantId: tenant.id
    });
    throw error; // Re-throw to preserve specific error types
  }
}

/**
 * Cancel customer booking
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID (for logging)
 * @param {string} bookingId - Booking ID to cancel
 * @returns {Object} Cancellation result
 */
async function cancelBooking(tenant, customerId, bookingId) {
  const startTime = Date.now();

  try {
    logEvent('customer_service_cancel_booking_start', {
      customerId,
      bookingId,
      tenantId: tenant.id
    });

    const result = await bookingService.cancelBooking(tenant, bookingId);

    logPerformance(null, 'customer_service_cancel_booking', startTime, {
      customerId,
      bookingId,
      tenantId: tenant.id
    });

    return result;
  } catch (error) {
    logError(error, {
      operation: 'cancelBooking',
      customerId,
      bookingId,
      duration: Date.now() - startTime,
      tenantId: tenant.id
    });
    throw error; // Re-throw to preserve specific error types
  }
}

module.exports = {
  getCustomerInfo,
  updateCustomerInfo,
  getCustomerBookings,
  createBooking,
  cancelBooking
};
