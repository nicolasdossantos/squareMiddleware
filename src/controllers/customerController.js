/**
 * Customer Controller
 * Handles customer information and booking operations
 */

const { sendSuccess, sendError, sendNotFound } = require('../utils/responseBuilder');
const { logPerformance, logEvent } = require('../utils/logger');
const logger = require('../utils/logger');
const customerService = require('../services/customerService');

/**
 * Get customer by ID
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID
 * @returns {Object} Customer info
 */
async function getCustomerById(tenant, customerId) {
  try {
    return await customerService.getCustomerInfo(tenant, customerId);
  } catch (error) {
    logger.error('Error getting customer by ID:', error);
    throw error;
  }
}

/**
 * Get customer by phone number
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} phone - Phone number
 * @returns {Object} Customer info
 */
async function getCustomerByPhone(tenant, phone) {
  try {
    return await customerService.getCustomerInfo(tenant, phone);
  } catch (error) {
    logger.error('Error getting customer by phone:', error);
    throw error;
  }
}

/**
 * Create new customer
 * @param {Object} tenant - Tenant context with credentials
 * @param {Object} customerData - Customer data
 */
async function createCustomer(tenant, customerData) {
  try {
    return await customerService.createCustomer(tenant, customerData);
  } catch (error) {
    logger.error('Error creating customer:', error);
    throw error;
  }
}

/**
 * Update customer
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID
 * @param {Object} updateData - Update data
 */
async function updateCustomer(tenant, customerId, updateData) {
  try {
    return await customerService.updateCustomerInfo(tenant, customerId, updateData);
  } catch (error) {
    logger.error('Error updating customer:', error);
    throw error;
  }
}

/**
 * List customers
 * @param {Object} tenant - Tenant context with credentials
 * @param {Object} filters - Filter options
 */
async function listCustomers(tenant, filters = {}) {
  try {
    return await customerService.listCustomers(tenant, filters);
  } catch (error) {
    logger.error('Error listing customers:', error);
    throw error;
  }
}

/**
 * Update customer information
 */
async function updateCustomerInfo(req, res) {
  const startTime = Date.now();
  const { tenant, correlationId } = req;

  // 🔍 COMPREHENSIVE PARAMETER LOGGING FOR UPDATE CUSTOMER INFO
  console.log('🚀 [UPDATE CUSTOMER] Raw request received:', {
    method: req.method,
    url: req.url,
    tenantId: tenant.id,
    headers: {
      'content-type': req.headers?.['content-type'] || 'N/A',
      'user-agent': req.headers?.['user-agent'] || 'N/A',
      'x-correlation-id': req.headers?.['x-correlation-id'] || 'N/A'
    },
    timestamp: new Date().toISOString()
  });

  console.log('📋 [UPDATE CUSTOMER] Query parameters:', JSON.stringify(req.query, null, 2));
  console.log('📋 [UPDATE CUSTOMER] Route parameters:', JSON.stringify(req.params, null, 2));
  console.log('📋 [UPDATE CUSTOMER] Request body analysis:', {
    bodyKeys: Object.keys(req.body || {}),
    bodySize: JSON.stringify(req.body || {}).length,
    rawBody: JSON.stringify(req.body, null, 2)
  });

  // Support both Express.js (customerId) and Azure Functions (customer_id) formats
  const customerId = req.query.customerId || req.params.customerId || req.body.customerId || req.body.customer_id;

  console.log('🔍 [UPDATE CUSTOMER] Customer ID extraction:', {
    queryCustomerId: req.query.customerId,
    paramsCustomerId: req.params.customerId,
    bodyCustomerId: req.body.customerId,
    bodyCustomer_id: req.body.customer_id,
    finalCustomerId: customerId,
    correlationId
  });

  // Remove customer ID from update data to avoid conflicts
  const updateData = { ...req.body };
  delete updateData.customerId;
  delete updateData.customer_id;

  console.log('📝 [UPDATE CUSTOMER] Update data analysis:', {
    originalBodyKeys: Object.keys(req.body || {}),
    cleanedUpdateDataKeys: Object.keys(updateData),
    updateDataPresent: !!Object.keys(updateData).length,
    correlationId
  });

  if (!customerId) {
    console.log('❌ [UPDATE CUSTOMER] Missing customer ID');
    return res.status(400).json({
      success: false,
      message: 'Customer ID is required',
      timestamp: new Date().toISOString()
    });
  }

  console.log('👤 [UPDATE CUSTOMER] Starting update process for customer:', customerId);

  try {
    logEvent('update_customer_info_request', {
      customerId,
      correlationId,
      updateFields: Object.keys(updateData)
    });

    const updatedCustomer = await customerService.updateCustomerInfo(tenant, customerId, updateData);

    logPerformance(correlationId, 'update_customer_info', startTime, {
      customerId,
      updatedFields: Object.keys(updateData)
    });

    logEvent('update_customer_info_success', {
      customerId,
      correlationId,
      updatedFields: Object.keys(updateData)
    });

    sendSuccess(res, updatedCustomer, 'Customer information updated successfully');
  } catch (error) {
    logPerformance(correlationId, 'update_customer_info_error', startTime, {
      customerId,
      error: error.message
    });

    if (error.message.includes('not found')) {
      return sendNotFound(res, 'Customer', 'Customer not found');
    }

    sendError(res, 'Failed to update customer information', 500, error.message);
  }
}

/**
 * Cancel customer booking
 */
async function cancelBooking(req, res) {
  const startTime = Date.now();
  const { customerId, bookingId } = req.params;
  const { correlationId, tenant } = req;

  try {
    logEvent('cancel_booking_request', {
      customerId,
      bookingId,
      correlationId,
      tenantId: tenant.id
    });

    const result = await customerService.cancelBooking(tenant, customerId, bookingId);

    logPerformance(correlationId, 'cancel_booking', startTime, {
      customerId,
      bookingId
    });

    logEvent('cancel_booking_success', {
      customerId,
      bookingId,
      correlationId
    });

    sendSuccess(res, result, 'Booking cancelled successfully');
  } catch (error) {
    logPerformance(correlationId, 'cancel_booking_error', startTime, {
      customerId,
      bookingId,
      error: error.message
    });

    if (error.message.includes('not found')) {
      return sendNotFound(res, 'Booking', 'Booking not found');
    }

    sendError(res, 'Failed to cancel booking', 500, error.message);
  }
}

/**
 * Get customer information by phone (Azure Functions compatibility)
 */
async function getCustomerInfoByPhone(req, res) {
  const startTime = Date.now();
  const { caller_id, phone, phoneNumber } = req.body;
  const { correlationId, tenant } = req;

  // Use caller_id, phone, or phoneNumber from request body (multiple formats for compatibility)
  const customerPhone = caller_id || phone || phoneNumber;

  try {
    logEvent('get_customer_info_by_phone_request', {
      phoneNumber: customerPhone,
      correlationId,
      tenantId: tenant.id
    });

    // Call the customer service to get info by phone
    const customerServiceResult = await customerService.getCustomerInfo(tenant, customerPhone);

    // Extract the actual customer from the service result
    const foundCustomer = customerServiceResult?.customer;
    let customerInfo;

    if (!foundCustomer) {
      logger.info('Customer not found, attempting fallback search with additional phone formats', {
        originalPhone: customerPhone,
        correlationId
      });

      // Try additional fallback searches with different phone formats
      let fallbackCustomer = null;
      const fallbackFormats = [];

      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/\D/g, '');

        // Try different phone number formats
        if (cleanPhone.length >= 10) {
          // Try with +1 prefix
          if (cleanPhone.length === 10) {
            fallbackFormats.push(`+1${cleanPhone}`, `1${cleanPhone}`);
          }
          // Try without country code
          if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
            fallbackFormats.push(cleanPhone.slice(1));
          }
          // Try formatted versions
          if (cleanPhone.length === 10) {
            fallbackFormats.push(`(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`);
            fallbackFormats.push(`${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`);
          }
        }
      }

      // Try each fallback format
      for (const format of fallbackFormats) {
        if (format !== customerPhone) {
          logger.info('Trying fallback phone format', { format, correlationId });
          try {
            const fallbackResult = await customerService.getCustomerInfo(tenant, format);
            if (fallbackResult?.customer) {
              fallbackCustomer = fallbackResult.customer;
              logger.info('Found customer with fallback format', {
                format,
                customerId: fallbackCustomer.id,
                correlationId
              });
              break;
            }
          } catch (fallbackError) {
            logger.warn('Fallback search failed for format', { format, error: fallbackError.message });
          }
        }
      }

      if (!fallbackCustomer) {
        logger.info('No customer found even with fallback searches', {
          originalPhone: customerPhone,
          attemptedFormats: fallbackFormats,
          correlationId
        });

        // For ElevenLabs, return a response even for non-customers
        customerInfo = {
          ...customerServiceResult,
          customer: null
        };
      } else {
        // Use the fallback customer data
        customerInfo = { ...customerServiceResult, customer: fallbackCustomer };
      }
    } else {
      customerInfo = customerServiceResult;
    }

    // Get current bookings for the customer using tenant-specific Square client
    const { createSquareClient } = require('../utils/squareUtils');
    const square = createSquareClient(tenant.accessToken);

    const context = {
      log: (...args) => logger.info(...args),
      error: (...args) => logger.error(...args)
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago (matches Azure Functions)
    const customerData = customerInfo.customer;

    // Get bookings using separate API calls like Azure Functions (only if customer exists)
    let futureBookings = [];
    let pastBookings = [];

    if (customerData) {
      try {
        // Get future bookings (from now onwards) - will filter for ACCEPTED and PENDING later
        const futureBookingsPromise = square.bookings.list({
          customerId: customerData.id,
          startAtMin: now.toISOString(),
          limit: 10
        });

        // Get past bookings (last 30 days only) - will filter for ACCEPTED later
        const pastBookingsPromise = square.bookings.list({
          customerId: customerData.id,
          startAtMin: thirtyDaysAgo.toISOString(),
          startAtMax: now.toISOString(),
          limit: 50
        });

        // Execute both API calls in parallel
        const [futureResponse, pastResponse] = await Promise.all([futureBookingsPromise, pastBookingsPromise]);

        // Extract bookings from responses (handle different response formats)
        if (futureResponse.result?.bookings) {
          futureBookings = futureResponse.result.bookings;
        } else if (Array.isArray(futureResponse.data)) {
          futureBookings = futureResponse.data;
        }

        if (pastResponse.result?.bookings) {
          pastBookings = pastResponse.result.bookings;
        } else if (Array.isArray(pastResponse.data)) {
          pastBookings = pastResponse.data;
        }

        logger.info('📊 Square API bookings retrieved', {
          futureBookings: futureBookings.length,
          pastBookings: pastBookings.length,
          correlationId
        });
      } catch (bookingError) {
        logger.error('Error fetching bookings from Square API:', bookingError);
        // Continue with empty arrays if API fails
      }
    }

    // IMMEDIATELY clean BigInt values before processing
    const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
    const cleanedFutureBookings = cleanBigIntFromObject(futureBookings);
    const cleanedPastBookings = cleanBigIntFromObject(pastBookings);

    // Debug: Log booking structure to understand the data format
    logger.info('🔍 Debug: Bookings structure from Square API', {
      futureBookingsCount: cleanedFutureBookings.length,
      pastBookingsCount: cleanedPastBookings.length,
      futureBookingStatuses: cleanedFutureBookings.map(b => ({ id: b.id, status: b.status, startAt: b.startAt })),
      pastBookingStatuses: cleanedPastBookings.map(b => ({ id: b.id, status: b.status, startAt: b.startAt })),
      correlationId
    });

    // Filter for future bookings - ACCEPTED and PENDING (matches Azure Functions)
    const nextBookings = cleanedFutureBookings
      .filter(booking => booking.status === 'ACCEPTED' || booking.status === 'PENDING')
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)) // ASC order (earliest first)
      .slice(0, 10);

    // Filter for past bookings - only ACCEPTED status (matches Azure Functions)
    const filteredPastBookings = cleanedPastBookings
      .filter(booking => booking.status === 'ACCEPTED')
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)) // DESC order (most recent first)
      .slice(0, 10);

    // Format bookings for ElevenLabs response
    const formatBooking = booking => {
      const startDate = new Date(booking.startAt);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const daysAway = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));

      return {
        booking_id: booking.id,
        status: booking.status,
        start_at: booking.startAt,
        end_at: '', // Not typically used
        date: formatter.format(startDate),
        time: timeFormatter.format(startDate),
        days_away: daysAway,
        service_variation_id: booking.appointmentSegments?.[0]?.serviceVariationId || '',
        team_member_id: booking.appointmentSegments?.[0]?.teamMemberId || '',
        location_id: booking.locationId,
        customer_note: booking.customerNote || '',
        seller_note: booking.sellerNote || '',
        version: booking.version || 0,
        created_at: booking.createdAt,
        updated_at: booking.updatedAt,
        appointment_segments: booking.appointmentSegments || []
      };
    };

    // Load service variations and staff members using tenant-scoped utilities
    const { loadServiceVariations, loadStaffMembers } = require('../utils/squareUtils');

    const [servicesData, staffData] = await Promise.all([
      loadServiceVariations(context, tenant).catch(() => ({ services: [] })),
      loadStaffMembers(context, tenant).catch(() => ({ staffMembers: [] }))
    ]);

    // Build service variations lookup
    const serviceVariations = {};
    servicesData.services?.forEach(service => {
      service.variations?.forEach(variation => {
        serviceVariations[variation.id] = {
          serviceName: service.name,
          variationName: variation.name,
          priceFormatted: `$${(parseInt(variation.price || '0') / 100).toFixed(2)}`,
          durationMinutes: Math.round(parseInt(variation.duration || '0') / 60000),
          teamMemberIds: variation.teamMemberIds || []
        };
      });
    });

    // Build staff members data
    const staffWithIds =
      staffData.staffMembers?.map(staffMember => ({
        id: staffMember.id,
        name: staffMember.fullName || `${staffMember.firstName} ${staffMember.lastName}`.trim(),
        displayName: staffMember.firstName === 'wariton' ? 'Junior' : staffMember.firstName || 'Staff Member'
      })) || [];

    // Get current date/time in store timezone
    const currentDateTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }).format(now);

    // Format phone for display
    const formatPhoneForDisplay = phone => {
      if (!phone) return '';
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
      }
      return phone;
    };

    // Generate initial message based on customer status
    let initialMessage = 'Thank you for calling. Who am I speaking with today?'; // Generic default message

    if (customerData) {
      // is_returning_customer is true
      const firstName = customerData?.givenName || customerData?.firstName || '';
      const fullName = customerData
        ? `${customerData.givenName || customerData.firstName || ''} ${
            customerData.familyName || customerData.lastName || ''
          }`.trim()
        : '';
      const lastName = customerData?.familyName || customerData?.lastName || '';

      // Try names in priority order: firstName -> fullName -> lastName
      let nameToUse = '';
      if (firstName) {
        nameToUse = firstName;
      } else if (fullName) {
        nameToUse = fullName;
      } else if (lastName) {
        nameToUse = lastName;
      }

      if (nameToUse) {
        initialMessage = `Thank you for calling. Am I speaking to ${nameToUse}?`;
      }
    }

    // Build response in exact ElevenLabs format
    const elevenLabsResponse = {
      success: true,
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        customer_first_name: customerData?.givenName || customerData?.firstName || '',
        customer_last_name: customerData?.familyName || customerData?.lastName || '',
        customer_full_name: customerData
          ? `${customerData.givenName || customerData.firstName || ''} ${
              customerData.familyName || customerData.lastName || ''
            }`.trim()
          : '',
        customer_email: customerData?.emailAddress || customerData?.email || '',
        customer_phone: formatPhoneForDisplay(customerPhone),
        customer_id: customerData?.id || '',
        upcoming_bookings_json: JSON.stringify(nextBookings.map(formatBooking)),
        booking_history_json: JSON.stringify(filteredPastBookings.map(formatBooking)),
        is_returning_customer: !!customerData,
        current_datetime_store_timezone: currentDateTime,
        service_variations_json: JSON.stringify(serviceVariations),
        staff_with_ids_json: JSON.stringify(staffWithIds),
        available_staff: staffWithIds.map(s => s.displayName).join(', '),
        available_services: servicesData.services?.map(s => s.name).join(', ') || '',
        caller_id: customerPhone.replace(/\D/g, '').slice(-10), // Strip country code
        initial_message: initialMessage,
        mensagem_inicial: 'Em que posso ajudar?' // Generic Portuguese greeting
      },
      correlation_id: correlationId
    };

    logPerformance(correlationId, 'get_customer_info_by_phone', startTime, {
      success: true
    });

    return res.json(elevenLabsResponse);
  } catch (error) {
    logger.error('Error in getCustomerInfoByPhone:', error);

    logPerformance(correlationId, 'get_customer_info_by_phone', startTime, {
      success: false,
      error: error.message
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to get customer information',
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId
    });
  }
}

/**
 * Update customer information (Azure Functions compatibility)
 * PUT /api/customers/update
 */
async function updateCustomerInfoCompatibility(req, res) {
  const { tenant } = req;

  console.log('🔍 COMPATIBILITY FUNCTION CALLED');
  console.log('req.body:', req.body);

  try {
    // Support both Express.js (customerId) and Azure Functions (customer_id) formats
    const customerId = req.body.customerId || req.body.customer_id;
    const updateData = { ...req.body };
    delete updateData.customerId;
    delete updateData.customer_id;

    console.log('Extracted customerId:', customerId);

    if (!customerId) {
      console.log('❌ Customer ID is missing in compatibility function!');
      return sendError(res, 'Customer ID is required', 400);
    }

    const updatedCustomer = await customerService.updateCustomerInfo(tenant, customerId, updateData);

    sendSuccess(res, 'Customer information updated successfully', {
      customer: updatedCustomer
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendError(res, 'Customer not found', 404, error.message);
    }

    sendError(res, 'Failed to update customer information', 500, error.message);
  }
}

// Customer Info API endpoint
async function getCustomerInfo(req, res) {
  const { tenant } = req;

  try {
    logger.info('Customer info request received', {
      method: req.method,
      query: req.query,
      body: req.body,
      tenantId: tenant.id
    });

    // Handle both query params and body params
    const phone = req.query.phone || req.body.phone;
    const customer_id = req.query.customer_id || req.body.customer_id;

    if (!phone && !customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Either phone or customer_id is required',
        timestamp: new Date().toISOString()
      });
    }

    let customer;
    if (customer_id) {
      customer = await getCustomerById(tenant, customer_id);
    } else {
      customer = await getCustomerByPhone(tenant, phone);
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      message: customer,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in getCustomerInfo:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get customer bookings
 */
async function getCustomerBookings(req, res) {
  const startTime = Date.now();
  const { customerId } = req.params;
  const { status, startDate, endDate, limit } = req.query;
  const { correlationId, tenant } = req;

  try {
    logEvent('get_customer_bookings_request', {
      customerId,
      filters: { status, startDate, endDate, limit },
      correlationId,
      tenantId: tenant.id
    });

    const filters = {
      status,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined
    };

    const bookings = await customerService.getCustomerBookings(tenant, customerId, filters);

    logPerformance(correlationId, 'get_customer_bookings', startTime, {
      customerId,
      bookingCount: bookings.length
    });

    logEvent('get_customer_bookings_success', {
      customerId,
      bookingCount: bookings.length,
      correlationId
    });

    sendSuccess(res, bookings, 'Customer bookings retrieved successfully');
  } catch (error) {
    logPerformance(correlationId, 'get_customer_bookings_error', startTime, {
      customerId,
      error: error.message
    });

    sendError(res, 'Failed to retrieve customer bookings', 500, error.message);
  }
}

module.exports = {
  getCustomerById,
  getCustomerByPhone,
  createCustomer,
  updateCustomer,
  listCustomers,
  getCustomerBookings,
  cancelBooking,
  getCustomerInfoByPhone,
  updateCustomerInfoCompatibility,
  getCustomerInfo,
  updateCustomerInfo
};
