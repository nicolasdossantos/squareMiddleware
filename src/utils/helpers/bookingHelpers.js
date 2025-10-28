// BookingManager/helpers.js
//
// 🔴 IMPORTANT: Square SDK v42+ Response Structure
// All API responses use response.result.* (NOT direct properties)
// See SQUARE_SDK_V42_RESPONSE_STRUCTURE.md for complete reference
//
const {
  createSquareClient,
  logApiCall,
  searchCustomerByPhone,
  createCustomer,
  validateEmailAddress,
  validatePhoneNumber,
  formatPhoneNumber
} = require('../squareUtils');
const { logger } = require('../logger');
const { toBigInt, formatPrice, durationToMinutes } = require('./bigIntUtils');

// const ACTIVE_BOOKINGS = new Set(['ACCEPTED', 'PENDING']);

/**
 * Validates booking data for create/update operations
 * This function is specific to the BookingManag/**
 * Get bookings by customer ID or phone number
 * This function is specific to the BookingManager endpoint
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID (optional)
 * @param {string} phoneNumber - Phone number (optional)
 * @returns {Array} Customer bookings
 */
async function getBookingsByCustomer(context, tenant, customerId, phoneNumber) {
  // Use getAllBookingsByCustomer for compatibility
  return await getAllBookingsByCustomer(context, tenant, customerId, phoneNumber);
}

/**
 * Get all bookings by customer ID or phone number endpoint
 */
function validateBookingData(bookingData, isPartialUpdate = false) {
  const errors = [];

  // 🔍 CRITICAL DEBUG: Log the exact data being validated
  logger.info('🔍 [VALIDATION DEBUG] validateBookingData called with:', {
    bookingDataType: typeof bookingData,
    bookingDataKeys: bookingData ? Object.keys(bookingData) : 'null/undefined',
    bookingDataRaw: JSON.stringify(bookingData, null, 2),
    isPartialUpdate,
    timestamp: new Date().toISOString()
  });

  if (!bookingData || typeof bookingData !== 'object') {
    logger.info('❌ [VALIDATION DEBUG] Invalid booking data object:', bookingData);
    errors.push('Booking data must be a valid object');
    return { isValid: false, errors };
  }

  // Required fields for create (optional for update)
  if (!isPartialUpdate) {
    if (!bookingData.appointmentSegments || !Array.isArray(bookingData.appointmentSegments)) {
      errors.push('appointmentSegments is required and must be an array');
    } else {
      bookingData.appointmentSegments.forEach((segment, index) => {
        if (!segment.serviceVariationId) {
          errors.push(`appointmentSegments[${index}].serviceVariationId is required`);
        }
        if (!segment.teamMemberId) {
          errors.push(`appointmentSegments[${index}].teamMemberId is required`);
        }
        if (!segment.serviceVariationVersion) {
          errors.push(`appointmentSegments[${index}].serviceVariationVersion is required`);
        }
        if (!segment.durationMinutes) {
          errors.push(`appointmentSegments[${index}].durationMinutes is required`);
        }
      });
    }

    if (!bookingData.startAt) {
      errors.push('startAt timestamp is required');
    }
  }

  // Validate timestamp format if provided
  if (bookingData.startAt) {
    const startAt = new Date(bookingData.startAt);
    if (isNaN(startAt.getTime())) {
      errors.push('startAt must be a valid ISO 8601 timestamp');
    } else if (startAt < new Date()) {
      errors.push('startAt cannot be in the past');
    }
  }

  // Validate customer information if provided
  if (bookingData.customerNote && typeof bookingData.customerNote !== 'string') {
    errors.push('customerNote must be a string');
  }

  if (bookingData.sellerNote && typeof bookingData.sellerNote !== 'string') {
    errors.push('sellerNote must be a string');
  }

  // If no customerId provided, validate customer creation data
  if (!bookingData.customerId && !isPartialUpdate) {
    const { firstName, lastName, email, phoneNumber } = bookingData;

    if (!firstName && !lastName && !email && !phoneNumber) {
      errors.push(
        'Either customerId or customer information (firstName, lastName, email, phoneNumber) is required'
      );
    }

    // Validate email format if provided
    if (email) {
      const emailValidation = validateEmailAddress(email);
      if (!emailValidation.isValid) {
        errors.push(`Invalid email: ${emailValidation.error}`);
      }
    }

    // Validate and format phone number if provided
    if (phoneNumber) {
      const phoneFormatResult = formatPhoneNumber(phoneNumber);
      if (!phoneFormatResult.isValid) {
        errors.push(`Invalid phone number: ${phoneFormatResult.error}`);
      } else {
        // Update the bookingData with the formatted phone number
        bookingData.phoneNumber = phoneFormatResult.formatted;
      }
    }
  }
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : null
  };
}

/**
 * Create a new booking
 * This function is specific to the BookingManager endpoint
 * If no customerId is provided, it will create a new customer first
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @param {Object} bookingData - Booking data including customer info
 * @returns {Object} Created booking
 */
async function createBooking(context, tenant, bookingData) {
  const startTime = Date.now();

  try {
    logApiCall(context, 'bookings.createBooking', startTime);

    let customerId = bookingData.customerId;
    let customerEmail = bookingData.email;
    let customerPhone = bookingData.phoneNumber;

    // If no customerId provided, create a new customer
    if (!customerId) {
      const { firstName, lastName, email, phoneNumber } = bookingData;

      context.log('No customerId provided, attempting to create new customer');
      context.log('Customer data:', { firstName, lastName, email, phoneNumber });
      
      customerEmail = email;
      customerPhone = phoneNumber;

      // Check if customer already exists by phone number first (if provided)
      if (phoneNumber) {
        context.log('📞 Checking if customer already exists with phone:', phoneNumber);
        const existingCustomer = await searchCustomerByPhone(context, tenant, phoneNumber);

        if (existingCustomer) {
          context.log(
            `✅ Found existing customer: ${existingCustomer.id} (${existingCustomer.given_name}
            ${existingCustomer.family_name})`
          );
          customerId = existingCustomer.id;
        }
      }

      // If still no customer, create a new one
      if (!customerId) {
        context.log('👤 Creating new customer');

        const newCustomer = await createCustomer(context, tenant, {
          firstName,
          lastName,
          email,
          phoneNumber
        });

        customerId = newCustomer.id;
        context.log(`✅ Successfully created new customer: ${customerId}`);
      }
    } else {
      // If customerId is provided, fetch customer details to get email/phone for buyer-level booking
      context.log('📧 Fetching customer details for buyer-level booking requirements');
      const square = createSquareClient(
        tenant.accessToken || tenant.squareAccessToken,
        tenant.squareEnvironment || tenant.environment || 'production'
      );
      
      try {
        const customerResponse = await square.customersApi.retrieveCustomer(customerId);
        const customer = customerResponse.result?.customer;
        
        if (customer) {
          customerEmail = customer.emailAddress || customerEmail;
          customerPhone = customer.phoneNumber || customerPhone;
          context.log('📧 Retrieved customer contact:', { 
            email: customerEmail ? '✓' : '✗', 
            phone: customerPhone ? '✓' : '✗' 
          });
        }
      } catch (error) {
        context.warn('⚠️ Could not fetch customer details:', error.message);
      }
    }

    // ✅ PRE-BOOKING CONFLICT CHECK
    // Check if customer already has a booking at the requested time
    context.log('🔍 [CONFLICT CHECK] Starting conflict check for customer:', customerId);
    context.log('🔍 [CONFLICT CHECK] Requested start time:', bookingData.startAt);
    const requestedStartTime = new Date(bookingData.startAt);

    try {
      // Get customer's existing bookings around the requested time (±30 minutes)
      const bufferMinutes = 30;
      const searchStart = new Date(requestedStartTime.getTime() - bufferMinutes * 60 * 1000);
      const searchEnd = new Date(requestedStartTime.getTime() + bufferMinutes * 60 * 1000);

      context.log(
        '🔍 [CONFLICT CHECK] Searching bookings from',
        searchStart.toISOString(),
        'to',
        searchEnd.toISOString()
      );

      // Create tenant-specific Square client for conflict check
      const square = createSquareClient(
        tenant.accessToken || tenant.squareAccessToken,
        tenant.squareEnvironment || tenant.environment || 'production'
      );
      const existingBookingsResponse = await square.bookingsApi.listBookings({
        customerId,
        startAtMin: searchStart.toISOString(),
        startAtMax: searchEnd.toISOString(),
        limit: 20
      });

      const existingBookings = existingBookingsResponse.result?.bookings || [];
      context.log('🔍 [CONFLICT CHECK] Found', existingBookings.length, 'existing bookings in time range');

      // Check for conflicts with ACCEPTED or PENDING bookings
      const conflictingBookings = existingBookings.filter(booking => {
        if (booking.status !== 'ACCEPTED' && booking.status !== 'PENDING') {
          context.log('🔍 [CONFLICT CHECK] Skipping booking', booking.id, 'with status:', booking.status);
          return false; // Skip cancelled/completed bookings
        }

        const bookingStart = new Date(booking.startAt);
        const timeDifference = Math.abs(bookingStart.getTime() - requestedStartTime.getTime());
        const minutesDiff = timeDifference / (1000 * 60);

        context.log(
          '🔍 [CONFLICT CHECK] Checking booking',
          booking.id,
          'at',
          booking.startAt,
          '- time diff:',
          minutesDiff,
          'minutes'
        );

        // Consider it a conflict if within 15 minutes
        const isConflict = timeDifference < 15 * 60 * 1000;
        if (isConflict) {
          context.log('🔍 [CONFLICT CHECK] ❌ CONFLICT DETECTED with booking', booking.id);
        }
        return isConflict;
      });

      if (conflictingBookings.length > 0) {
        context.log('❌ [CONFLICT CHECK] Customer already has a booking at this time:', {
          requestedTime: bookingData.startAt,
          conflictingBookings: conflictingBookings.map(b => ({
            id: b.id,
            startAt: b.startAt,
            status: b.status
          }))
        });
        throw new Error(
          'Customer already has an appointment at this time. Please select a different time slot.'
        );
      }

      context.log('✅ [CONFLICT CHECK] No booking conflicts found, proceeding with booking');
    } catch (conflictError) {
      if (conflictError.message.includes('already has an appointment')) {
        context.log('❌ [CONFLICT CHECK] Blocking booking due to conflict');
        throw conflictError; // Re-throw conflict-specific errors
      }

      // Log but don't fail the booking for API errors
      context.log(
        '⚠️ [CONFLICT CHECK] Conflict check failed, proceeding with booking attempt:',
        conflictError.message
      );
    }

    const bookingPayload = {
      idempotencyKey: `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      booking: {
        locationId: tenant.locationId,
        startAt: bookingData.startAt,
        appointmentSegments: bookingData.appointmentSegments.map(segment => ({
          ...segment,
          serviceVariationVersion: toBigInt(segment.serviceVariationVersion)
        })),
        ...(bookingData.customerNote && { customerNote: bookingData.customerNote }),
        customerId
      }
    };

    context.log('📅 Creating booking with request:', {
      ...bookingPayload,
      booking: {
        ...bookingPayload.booking,
        appointmentSegments: bookingPayload.booking.appointmentSegments.map(seg => ({
          ...seg,
          serviceVariationVersion: seg.serviceVariationVersion.toString()
        }))
      }
    });

    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );
    const response = await square.bookingsApi.createBooking(bookingPayload);

    context.log('✅ Booking created successfully:', response.result?.booking?.id || response.booking?.id);

    const booking = response.booking || response.result?.booking;

    // Add customer information to the response for convenience
    return {
      ...booking,
      customerId
    };
  } catch (error) {
    context.error('❌ Error creating booking:', error);

    if (error.statusCode === 400) {
      throw new Error(`Invalid booking data: ${error.message}`);
    } else if (error.statusCode === 401) {
      throw new Error('Square API authentication failed');
    } else if (error.statusCode === 409) {
      throw new Error('Booking conflict - time slot may already be taken');
    }

    throw new Error(`Square API error: ${error.message}`);
  }
}

/**
 * Update an existing booking
 * This function is specific to the BookingManager endpoint
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} bookingId - Booking ID to update
 * @param {Object} updateData - Fields to update
 * @returns {Object} Updated booking
 */
async function updateBooking(context, tenant, bookingId, updateData) {
  const startTime = Date.now();

  try {
    logApiCall(context, 'bookings.updateBooking', startTime);

    const idempotencyKey = `update_${bookingId}_${Date.now()}`;
    const booking = {
      id: bookingId,
      version: updateData.version, // Required for updates
      ...(updateData.startAt && { startAt: updateData.startAt }),
      ...(updateData.status && { status: updateData.status }),
      ...(updateData.appointmentSegments && { appointmentSegments: updateData.appointmentSegments }),
      ...(updateData.customerNote && { customerNote: updateData.customerNote }),
      ...(updateData.sellerNote && { sellerNote: updateData.sellerNote })
    };

    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    // Square SDK v42+ expects individual parameters, not an object
    const response = await square.bookingsApi.updateBooking(bookingId, { idempotencyKey, booking });

    return { booking: response };
  } catch (error) {
    context.error('Error updating booking:', error);

    if (error.statusCode === 400) {
      throw new Error(`Invalid update data: ${error.message}`);
    } else if (error.statusCode === 401) {
      throw new Error('Square API authentication failed');
    } else if (error.statusCode === 404) {
      throw new Error('Booking not found');
    } else if (error.statusCode === 409) {
      throw new Error('Booking version conflict - booking may have been updated by another process');
    }

    throw new Error(`Square API error: ${error.message}`);
  }
}

/**
 * Cancel a booking
 * This function is specific to the BookingManager endpoint
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} bookingId - Booking ID to cancel
 * @returns {Object} Cancelled booking
 */
async function cancelBooking(context, tenant, bookingId) {
  const startTime = Date.now();

  try {
    logApiCall(context, 'bookings.cancelBooking', startTime);

    // First get the booking to get its version
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );
    const getResponse = await square.bookingsApi.retrieveBooking(bookingId);
    const bookingVersion = getResponse.result.booking.version;

    // Cancel the booking with required parameters (SDK v42+)
    const idempotencyKey = `cancel_${bookingId}_${Date.now()}`;
    const response = await square.bookingsApi.cancelBooking(bookingId, { idempotencyKey, bookingVersion });

    // Clean BigInt values before logging
    const { cleanBigIntFromObject } = require('./bigIntUtils');
    const cleanResponse = cleanBigIntFromObject(response);
    context.log('Cancel booking response:', cleanResponse);

    return { booking: response.result.booking };
  } catch (error) {
    context.error('Error canceling booking:', error);

    if (error.statusCode === 400) {
      throw new Error(`Cannot cancel booking: ${error.message}`);
    } else if (error.statusCode === 401) {
      throw new Error('Square API authentication failed');
    } else if (error.statusCode === 404) {
      throw new Error('Booking not found');
    }

    throw new Error(`Square API error: ${error.message}`);
  }
}

/**
 * Retrieve a specific booking
 * This function is specific to the BookingManager endpoint
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} bookingId - Booking ID to retrieve
 * @returns {Object} Booking details
 */
async function getBooking(context, tenant, bookingId) {
  const startTime = Date.now();

  try {
    logApiCall(context, 'bookings.retrieveBooking', startTime);

    context.log('Getting booking with:', {
      bookingId,
      hasAccessToken: !!tenant.accessToken,
      tokenLength: tenant.accessToken?.length,
      tokenPreview: tenant.accessToken?.substring(0, 10) + '...'
    });

    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );
    const response = await square.bookingsApi.retrieveBooking(bookingId);

    // Clean BigInt values before logging
    const { cleanBigIntFromObject } = require('./bigIntUtils');
    const cleanResponse = cleanBigIntFromObject(response);
    context.log('Get booking response:', cleanResponse);

    return { booking: response.result.booking };
  } catch (error) {
    context.error('Error retrieving booking:', error);

    if (error.statusCode === 401) {
      throw new Error('Square API authentication failed');
    } else if (error.statusCode === 404) {
      throw new Error('Booking not found');
    }

    throw new Error(`Square API error: ${error.message}`);
  }
}

/**
 * Get active bookings for a customer
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID (optional)
 * @param {string} phoneNumber - Phone number (optional)
 * @returns {Object} Active bookings
 */
async function getActiveBookingsByCustomer(context, tenant, customerId, phoneNumber) {
  context.log('Attempting to get active bookings for customer', { customerId, phoneNumber });
  const startTime = Date.now();

  try {
    if (!customerId && phoneNumber) {
      context.log('No customer ID provided, searching by phone number');
      const customer = await searchCustomerByPhone(context, tenant, phoneNumber);
      if (customer) {
        customerId = customer.id;
        context.log(`Customer found by phone: ${customerId}`);
      } else {
        context.log('No customer found by phone number, returning empty bookings array');
        return { bookings: [] };
      }
    }

    if (!customerId) {
      context.log('Customer ID is required to retrieve bookings, returning empty array');
      return { bookings: [] };
    }

    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    // Fetch all bookings using pagination to ensure we get everything
    let allBookings = [];
    try {
      // Add timeout protection for booking lookup
      const BOOKING_TIMEOUT = 1500; // Reduced to 1.5 seconds max
      const bookingPromise = square.bookingsApi.listBookings({
        customerId,
        limit: 5 // Aggressively reduced for fastest response
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Booking lookup timeout')), BOOKING_TIMEOUT)
      );

      let response;
      try {
        response = await Promise.race([bookingPromise, timeoutPromise]);
      } catch (error) {
        if (error.message === 'Booking lookup timeout') {
          context.log('⚠️ Booking lookup timed out, returning empty bookings array');
          return { bookings: [] };
        }
        throw {
          message: error.message || 'Failed to lookup bookings',
          code: error.code || 'LOOKUP_ERROR',
          status: error.statusCode || 500
        };
      }

      context.log('Square API call successful for customer', customerId);
      context.log('Response type:', typeof response);
      context.log('Response keys:', Object.keys(response));

      // Square SDK v42+ uses response.result.bookings
      if (response.result && response.result.bookings) {
        allBookings = response.result.bookings;
        context.log(`📄 Found bookings in response.result.bookings: ${allBookings.length}`);
      } else if (Array.isArray(response)) {
        allBookings = response;
        context.log(`📄 Response is array: ${allBookings.length}`);
      } else {
        context.log('❌ No bookings found in expected response structure');
        context.log('Available response keys:', Object.keys(response));
        allBookings = [];
      }

      // Skip pagination for fastest response - only use first page
      if (allBookings.length > 0) {
        context.log(
          `📄 Using only first page: ${allBookings.length} bookings (pagination disabled for performance)`
        );
      }
    } catch (apiError) {
      context.log(`❌ Square API error fetching bookings for customer ${customerId}:`, {
        error: apiError.message,
        stack: apiError.stack,
        customerId
      });
      logApiCall(context, 'bookings_list_for_closest', false, Date.now() - startTime, {
        customer_id: customerId,
        error: apiError.message
      });
      return { bookings: [] };
    }

    const apiDuration = Date.now() - startTime;

    if (allBookings.length === 0) {
      logApiCall(context, 'bookings_list_for_closest', true, apiDuration, {
        customer_id: customerId,
        bookings_found: 0
      });
      context.log(`No bookings found for customer ${customerId}`);
      return { bookings: [] };
    }

    context.log(`Processing ${allBookings.length} total bookings for filtering...`);

    const now = new Date();
    // Filter for future, active bookings, then sort to find the closest one
    const acceptedBookings = allBookings.filter(booking => {
      const bookingDate = new Date(booking.startAt);
      const isInFuture = bookingDate > now;
      const isAccepted = booking.status === 'ACCEPTED';

      context.log(
        `📋 Booking ${booking.id}: ${booking.startAt} - ` +
          `Status: ${booking.status} - ` +
          `Future: ${isInFuture} - Accepted: ${isAccepted}`
      );

      return isInFuture && isAccepted;
    });

    context.log(`✅ Found ${acceptedBookings.length} future ACCEPTED bookings`);

    const closestBooking = acceptedBookings.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

    const finalBooking = closestBooking.length > 0 ? [closestBooking[0]] : [];

    logApiCall(context, 'bookings_list_for_closest', true, apiDuration, {
      customer_id: customerId,
      booking_found: finalBooking.length > 0
    });

    context.log(
      `✅ Closest booking search for customer ${customerId}: Found ${finalBooking.length} active booking(s)`
    );

    return { bookings: finalBooking };
  } catch (error) {
    const apiDuration = Date.now() - startTime;
    logApiCall(context, 'bookings_list_for_closest', false, apiDuration, { customerId });
    context.log('❌ Error retrieving customer bookings to find closest:', {
      errorMessage: error.message,
      errorStack: error.stack,
      customerId
    });
    return { bookings: [] };
  }
}

/**
 * Get bookings by customer ID or phone number
 * This function is specific to the BookingManager endpoint
 * @param {Object} context - Request context with logging
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} customerId - Customer ID (optional)
 * @param {string} phoneNumber - Phone number (optional)
 * @returns {Object} Customer bookings
 */
async function getAllBookingsByCustomer(context, tenant, customerId, phoneNumber) {
  const startTime = Date.now();
  const MAX_PAGES = 25; // Reduced from 50 for better performance
  const MAX_EXECUTION_TIME = 30000; // 30 seconds timeout
  const MAX_BOOKINGS = 1000; // Maximum bookings to prevent memory issues

  try {
    // If we have a phone number but no customer ID, search for customer first
    if (!customerId && phoneNumber) {
      const customer = await searchCustomerByPhone(context, tenant, phoneNumber);
      if (!customer) {
        return { bookings: [] }; // No customer found
      }
      customerId = customer.id;
    }

    if (!customerId) {
      throw new Error('Customer ID is required to retrieve bookings');
    }

    const allBookings = [];
    let pageCount = 0;

    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    // Start with the first page request
    const apiStartTime = Date.now();
    let listResponse = await square.bookingsApi.listBookings({
      customerId,
      limit: 100 // Maximum allowed by Square API
    });
    let apiDuration = Date.now() - apiStartTime;

    do {
      pageCount++;

      // Check execution time limit
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        context.log.warn(`⚠️ Execution time limit reached (${MAX_EXECUTION_TIME}ms), stopping search`);
        break;
      }

      // Check if API call was successful
      if (!listResponse) {
        throw new Error('No response from Square bookings API');
      }

      // Square SDK v42+ uses response.result.bookings
      const bookings = listResponse.result?.bookings || [];

      const responseBookingCount = bookings.length;
      // Removed: square.customersApi.updateCustomer(); - This was causing issues

      // Log response structure for monitoring
      const hasNextPage = typeof listResponse.hasNextPage === 'function' ? listResponse.hasNextPage() : false;
      context.log(
        `📄 All Bookings API Response: ${responseBookingCount} bookings fetched, has next page: ${hasNextPage}`
      );

      logApiCall(context, 'bookings_list_all', true, apiDuration, {
        page: pageCount,
        booking_count: responseBookingCount,
        has_next_page: hasNextPage,
        customer_id: customerId
      });

      context.log(
        `📄 Page ${pageCount}: Fetched ${responseBookingCount} bookings for customer ${customerId}`
      );

      if (bookings.length > 0) {
        // Check if adding these bookings would exceed our limit
        if (allBookings.length + bookings.length > MAX_BOOKINGS) {
          const remainingSlots = MAX_BOOKINGS - allBookings.length;
          if (remainingSlots > 0) {
            allBookings.push(...bookings.slice(0, remainingSlots));
            context.log(`⚠️ Reached maximum bookings limit (${MAX_BOOKINGS}), truncating results`);
          }
          break;
        }

        allBookings.push(...bookings);
        context.log(`✅ Page ${pageCount}: Added ${bookings.length} bookings to results`);
      }

      // Safety check to prevent infinite loops
      if (pageCount >= MAX_PAGES) {
        context.log(`⚠️ Reached maximum page limit (${MAX_PAGES}), stopping search`);
        break;
      }

      // Check if there are more pages and load the next page using Square SDK methods
      if (listResponse.hasNextPage && listResponse.hasNextPage()) {
        const nextPageStartTime = Date.now();

        try {
          listResponse = await listResponse.getNextPage();
          apiDuration = Date.now() - nextPageStartTime;
        } catch (pageError) {
          context.log.error('❌ Error fetching next page:', pageError);
          break;
        }
      } else {
        // No more pages available
        break;
      }
    } while (pageCount < MAX_PAGES && Date.now() - startTime < MAX_EXECUTION_TIME);

    context.log(
      `✅ All bookings search completed: Found ${allBookings.length} total bookings ` +
        `across ${pageCount} pages for customer ${customerId} (${Date.now() - startTime}ms)`
    );

    const totalApiDuration = Date.now() - startTime;
    logApiCall(context, 'bookings_search_all_by_customer', true, totalApiDuration, {
      customer_id: customerId,
      pages_searched: pageCount,
      total_bookings: allBookings.length,
      search_completed: true,
      execution_time_ms: totalApiDuration
    });

    return { bookings: allBookings || [] };
  } catch (error) {
    const apiDuration = Date.now() - startTime;
    logApiCall(context, 'bookings_search_all_by_customer', false, apiDuration, {
      customer_id: customerId,
      error: error.message
    });

    context.error('Error retrieving customer bookings:', error);

    if (error.statusCode === 401) {
      throw new Error('Square API authentication failed');
    } else if (error.statusCode === 429) {
      throw new Error('Square API rate limit exceeded');
    } else if (error.statusCode === 404) {
      throw new Error('Customer not found');
    }

    throw new Error(`Square API error: ${error.message}`);
  }
}

/**
 * Get the next upcoming booking for ElevenLabs with detailed information
 * Returns a structured object with booking details including IDs for modifications
 */
async function getNextBookingForElevenLabs(context, customerId, services, barbers) {
  if (!customerId) {
    context.log('⚠️ No customer ID provided for booking search');
    return null;
  }

  try {
    context.log(`🔍 Searching for next booking for customer: ${customerId}`);

    // Get active bookings (reuse existing function)
    const bookingsResult = await getActiveBookingsByCustomer(context, customerId, null);

    context.log('📊 Booking search result:', {
      bookings_count: bookingsResult.bookings?.length || 0,
      has_bookings: !!bookingsResult.bookings,
      total_results: bookingsResult.total || 0
    });

    if (!bookingsResult.bookings || bookingsResult.bookings.length === 0) {
      context.log(`📅 No upcoming bookings found for customer ${customerId}`);
      return null;
    }

    const nextBooking = bookingsResult.bookings[0]; // Already sorted by closest date
    context.log(`📅 Found next booking with ID: ${nextBooking.id} for date: ${nextBooking.startAt}`);

    // Extract booking details safely
    const bookingDate = new Date(nextBooking.startAt);
    const now = new Date();
    const daysAway = Math.ceil((bookingDate - now) / (1000 * 60 * 60 * 24));

    // Get service and barber details
    const appointmentSegment = nextBooking.appointmentSegments?.[0];
    let serviceName = 'Unknown Service';
    let barberName = 'Unknown Barber';
    let totalPrice = '$0.00';
    let durationMinutes = 0;

    if (appointmentSegment) {
      // Find service details
      const service = services.find(s =>
        s.variations.some(v => v.id === appointmentSegment.serviceVariationId)
      );
      if (service) {
        const variation = service.variations.find(v => v.id === appointmentSegment.serviceVariationId);
        serviceName = `${service.name}${variation?.name && variation.name !== 'Regular' ? ` - ${variation.name}` : ''}`;

        if (variation?.price) {
          totalPrice = formatPrice(variation.price);
        }

        if (variation?.duration) {
          durationMinutes = durationToMinutes(variation.duration);
        }
      }

      // Find barber details
      const barber = barbers.find(b => b.id === appointmentSegment.teamMemberId);
      if (barber) {
        barberName = barber.firstName || barber.fullName || 'Barber';
        // Handle "wariton" -> "Junior" mapping
        if (barberName.toLowerCase() === 'wariton') {
          barberName = 'Junior';
        }
        // Capitalize first letter for display
        barberName = barberName.charAt(0).toUpperCase() + barberName.slice(1).toLowerCase();
      }
    }

    // Create booking object with all primitive values (no BigInt)
    const nextBookingData = {
      booking_id: String(nextBooking.id || ''),
      date: bookingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: bookingDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      service_name: String(serviceName),
      service_variation_id: String(appointmentSegment?.serviceVariationId || ''),
      barber_name: String(barberName),
      barber_id: String(appointmentSegment?.teamMemberId || ''),
      location_id: String(LOCATION_ID),
      days_away: Number(daysAway),
      status: String(nextBooking.status || 'ACCEPTED'),
      total_price: String(totalPrice),
      duration_minutes: Number(durationMinutes),
      start_at_iso: String(nextBooking.startAt)
    };

    return nextBookingData;
  } catch (error) {
    context.log('❌ Error in getNextBookingForElevenLabs:', error.message);
    return null;
  }
}

module.exports = {
  validateBookingData,
  createBooking,
  updateBooking,
  cancelBooking,
  getBooking,
  getBookingsByCustomer, // Add the missing function
  getActiveBookingsByCustomer,
  getAllBookingsByCustomer,
  getNextBookingForElevenLabs
};
