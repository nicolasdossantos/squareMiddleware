/**
 * Booking Controller
 * Comprehensive booking operations for Square API
 * Multi-tenant enabled with header-based authentication
 */

const { sendSuccess, sendError } = require('../utils/responseBuilder');
const { logPerformance, logEvent, logError, logger } = require('../utils/logger');
const bookingService = require('../services/bookingService');
const { validateBookingData } = require('../utils/helpers/bookingHelpers');
const { generateCorrelationId } = require('../utils/security');

/**
 * Core booking creation logic - pure business logic
 * Throws appropriate HTTP errors for Express.js error handling
 * @param {Object} tenant - Tenant context with credentials
 * @param {Object} bookingData - Booking data
 * @param {string} correlationId - Correlation ID for logging
 * @returns {Object} Created booking
 */
async function createBookingCore(tenant, bookingData, correlationId) {
  logEvent('booking_create_request', {
    correlationId,
    customerId: bookingData.customerId,
    serviceCount: bookingData.serviceIds?.length,
    staffMemberId: bookingData.staffMemberId,
    startAt: bookingData.startAt
  });

  // Validate input data
  const validationResult = validateBookingData(bookingData);
  if (!validationResult.isValid) {
    logEvent('booking_create_validation_failed', {
      correlationId,
      errors: validationResult.errors
    });
    const error = new Error('Invalid booking data');
    error.statusCode = 400;
    error.validationErrors = validationResult.errors;
    throw error;
  }

  // ✅ SLOT AVAILABILITY CHECK
  // Verify the requested time slot is still available before creating booking
  logger.info('🔍 [AVAILABILITY CHECK] Verifying slot is still available...', {
    startAt: bookingData.startAt,
    appointmentSegments: bookingData.appointmentSegments?.length,
    correlationId
  });

  try {
    const { createSquareClient } = require('../utils/squareUtils');

    // Create tenant-specific Square client
    const square = createSquareClient(tenant.accessToken);

    // Create segment filters for availability search
    const segmentFilters = bookingData.appointmentSegments.map(segment => ({
      serviceVariationId: segment.serviceVariationId,
      ...(segment.teamMemberId && {
        teamMemberIdFilter: {
          any: [segment.teamMemberId]
        }
      })
    }));

    // Search for availability at the exact requested time (±30 minutes window)
    // Note: Square API requires minimum 1 hour range
    const requestedStartTime = new Date(bookingData.startAt);
    const searchStart = new Date(requestedStartTime.getTime() - 30 * 60 * 1000);
    const searchEnd = new Date(requestedStartTime.getTime() + 30 * 60 * 1000);

    const availabilityResponse = await square.bookings.searchAvailability({
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
    const availableSlots = availabilityResponse.result?.availabilities || availabilityResponse.availabilities || [];

    logger.info('🔍 [AVAILABILITY CHECK] Square API response:', {
      availableSlotsCount: availableSlots.length,
      availableSlotTimes: availableSlots.slice(0, 5).map(s => s.startAt),
      correlationId
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
        requestedTime: bookingData.startAt,
        availableSlotsFound: availableSlots.length,
        sampleSlots: availableSlots.slice(0, 3).map(s => s.startAt),
        correlationId
      });

      const error = new Error('The requested time slot is no longer available. Please select a different time.');
      error.statusCode = 409;
      error.code = 'SLOT_UNAVAILABLE';
      error.availableSlots = availableSlots.slice(0, 10).map(s => ({
        startAt: s.startAt,
        appointmentSegments: s.appointmentSegments
      }));
      throw error;
    }

    logger.info('✅ [AVAILABILITY CHECK] Time slot is still available', {
      requestedTime: bookingData.startAt,
      correlationId
    });
  } catch (availabilityError) {
    if (availabilityError.statusCode) {
      // Re-throw HTTP errors (SLOT_UNAVAILABLE)
      throw availabilityError;
    }
    logger.error('⚠️ [AVAILABILITY CHECK] Error checking slot availability:', availabilityError.message);
    logger.error('⚠️ [AVAILABILITY CHECK] Full error details:', {
      message: availabilityError.message,
      stack: availabilityError.stack,
      correlationId
    });
    // Continue with booking creation despite availability check error
    // The Square API will reject it if truly unavailable
  }

  // ✅ CUSTOMER BOOKING CONFLICT CHECK
  // Check if customer already has a booking at the requested time
  if (bookingData.customerId) {
    logger.info('🔍 [CONFLICT CHECK] Checking for customer booking conflicts...', {
      customerId: bookingData.customerId,
      startAt: bookingData.startAt,
      correlationId
    });

    try {
      const { square } = require('../utils/squareUtils');

      // Get customer's existing bookings around the requested time (±30 minutes)
      const bufferMinutes = 30;
      const requestedStartTime = new Date(bookingData.startAt);
      const searchStart = new Date(requestedStartTime.getTime() - bufferMinutes * 60 * 1000);
      const searchEnd = new Date(requestedStartTime.getTime() + bufferMinutes * 60 * 1000);

      const existingBookingsResponse = await square.bookings.list({
        customerId: bookingData.customerId,
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
        })),
        correlationId
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
          requestedTime: bookingData.startAt,
          conflictingBookings: conflictingBookings.map(b => ({
            id: b.id,
            startAt: b.startAt,
            status: b.status
          })),
          correlationId
        });

        const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');

        const error = new Error(
          'Customer already has an appointment at this time. Please select a different time slot.'
        );
        error.statusCode = 409;
        error.code = 'BOOKING_CONFLICT';
        error.conflictingBookings = cleanBigIntFromObject(
          conflictingBookings.map(b => ({
            id: b.id,
            startAt: b.startAt,
            status: b.status
          }))
        );
        throw error;
      }

      logger.info('✅ [CONFLICT CHECK] No customer booking conflicts found', { correlationId });
    } catch (conflictError) {
      if (conflictError.statusCode) {
        // Re-throw HTTP errors
        throw conflictError;
      }
      logger.error('⚠️ [CONFLICT CHECK] Error checking customer conflicts:', conflictError.message);
      // Continue with booking creation despite conflict check error
    }
  }

  const result = await bookingService.createBooking(tenant, bookingData);

  // Check if booking creation was successful
  if (!result.success || !result.data) {
    logError('booking_create_failed', 'Booking service returned failure', {
      correlationId,
      result
    });

    const error = new Error('Failed to create booking');
    error.statusCode = 500;
    error.code = 'BOOKING_CREATION_FAILED';
    error.serviceError = result.error || 'Booking creation failed';
    throw error;
  }

  logEvent('booking_create_success', {
    correlationId,
    bookingId: result.data.id,
    customerId: bookingData.customerId
  });

  logEvent('booking_create_complete', {
    correlationId,
    bookingId: result.data.id,
    customerId: bookingData.customerId
  });

  // Return the booking data
  return {
    booking: result.data.booking
  };
}

/**
 * Create a new booking (Express handler)
 * Migrated from: handleCreateBooking in BookingManager
 */
async function createBooking(req, res, next) {
  const { correlationId, tenant } = req;
  const bookingData = req.body;

  // 🔍 DETAILED PARAMETER LOGGING FOR RETELL DEBUGGING
  console.log('🚀 [BOOKING CREATE] Raw request received:', {
    correlationId,
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-correlation-id': req.headers['x-correlation-id']
    },
    timestamp: new Date().toISOString()
  });

  console.log('📋 [BOOKING CREATE] Request body (raw):', JSON.stringify(bookingData, null, 2));

  console.log('🔍 [BOOKING CREATE] Parameter analysis:', {
    bodyType: typeof bookingData,
    bodyKeys: Object.keys(bookingData || {}),
    bodyLength: JSON.stringify(bookingData).length,
    hasCustomerId: !!bookingData?.customerId,
    hasAppointmentSegments: !!bookingData?.appointmentSegments,
    appointmentSegmentsType: typeof bookingData?.appointmentSegments,
    appointmentSegmentsLength: Array.isArray(bookingData?.appointmentSegments)
      ? bookingData.appointmentSegments.length
      : 'not-array',
    hasStartAt: !!bookingData?.startAt,
    correlationId
  });

  if (bookingData?.appointmentSegments) {
    console.log(
      '📅 [BOOKING CREATE] Appointment segments details:',
      bookingData.appointmentSegments.map((segment, index) => ({
        index,
        type: typeof segment,
        keys: Object.keys(segment || {}),
        serviceVariationId: segment?.serviceVariationId,
        teamMemberId: segment?.teamMemberId,
        durationMinutes: segment?.durationMinutes,
        serviceVariationVersion: segment?.serviceVariationVersion
      }))
    );
  }

  try {
    const result = await createBookingCore(tenant, bookingData, correlationId);

    // Success - return 201 Created with booking data
    res.status(201).json({
      success: true,
      data: result,
      message: 'Booking created successfully',
      timestamp: new Date().toISOString(),
      correlationId
    });
  } catch (error) {
    // Add correlation ID to error for logging
    error.correlationId = correlationId;

    // Handle specific error types
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        message: error.message,
        errors: error.validationErrors,
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    if (error.statusCode) {
      const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');

      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        ...(error.conflictingBookings && { conflictingBookings: cleanBigIntFromObject(error.conflictingBookings) }),
        ...(error.availableSlots && { availableSlots: cleanBigIntFromObject(error.availableSlots) }),
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    // Pass unhandled errors to Express error middleware
    next(error);
  }
}

/**
 * Core update booking logic - COPIED FROM AZURE FUNCTIONS
 */
/**
 * Core booking update logic - pure business logic
 * Throws appropriate HTTP errors for Express.js error handling
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} bookingId - Booking ID
 * @param {string} startAt - New start time
 * @param {string} note - Seller note
 * @param {string} customerId - Customer ID
 * @param {string} customerNote - Customer note
 * @param {string} endAt - New end time
 * @param {Array} appointmentSegments - Appointment segments
 * @returns {Object} Updated booking
 */
async function updateBookingCore(
  tenant,
  bookingId,
  startAt,
  note,
  customerId,
  customerNote,
  endAt,
  appointmentSegments
) {
  const correlationId = generateCorrelationId();

  // Helper function to safely convert date to ISO string
  const safeDateToISO = dateValue => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toISOString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // 🔍 COMPREHENSIVE PARAMETER LOGGING FOR UPDATE BOOKING CORE
  console.log('🚀 [UPDATE BOOKING CORE] Function called with parameters:', {
    correlationId,
    bookingId,
    startAt,
    startAtType: typeof startAt,
    startAtISO: safeDateToISO(startAt),
    note,
    customerId,
    customerNote,
    endAt,
    endAtType: typeof endAt,
    endAtISO: safeDateToISO(endAt),
    appointmentSegments,
    hasAppointmentSegments: !!appointmentSegments,
    appointmentSegmentsLength: appointmentSegments ? appointmentSegments.length : 0,
    timestamp: new Date().toISOString()
  });

  // Validate required parameters
  if (!bookingId) {
    console.log('❌ [UPDATE BOOKING CORE] Missing required parameter: bookingId');
    throw new Error('bookingId is required');
  }

  // Validate startAt if provided
  if (startAt && safeDateToISO(startAt) === 'Invalid Date') {
    console.log('❌ [UPDATE BOOKING CORE] Invalid startAt date:', startAt);
    throw new Error('Invalid time value for startAt');
  }

  // Validate endAt if provided
  if (endAt && safeDateToISO(endAt) === 'Invalid Date') {
    console.log('❌ [UPDATE BOOKING CORE] Invalid endAt date:', endAt);
    throw new Error('Invalid time value for endAt');
  }

  console.log('📅 [UPDATE BOOKING CORE] Starting update process for booking:', bookingId);

  logEvent('booking_update_core_attempt', {
    correlationId,
    bookingId,
    hasStartAt: !!startAt,
    hasNote: !!note,
    hasCustomerId: !!customerId,
    hasCustomerNote: !!customerNote,
    hasEndAt: !!endAt
  });

  try {
    // Prepare update data for booking service
    const updateData = {};
    if (startAt) updateData.startAt = startAt;
    if (endAt) updateData.endAt = endAt;
    if (note) updateData.note = note;
    if (customerNote) updateData.customerNote = customerNote;
    if (customerId) updateData.customerId = customerId;
    if (appointmentSegments) updateData.appointmentSegments = appointmentSegments;

    console.log('🚀 [UPDATE BOOKING CORE] Calling booking service with:', updateData);
    // Call the booking service with tenant context
    const result = await bookingService.updateBooking(tenant, bookingId, updateData, correlationId);
    console.log('✅ [UPDATE BOOKING CORE] Booking service response:', result);
    return result;
  } catch (error) {
    console.error('❌ [UPDATE BOOKING CORE] Error calling booking service:', error);
    throw error;
  }
}

/**
 * Update an existing booking (Express handler)
 * Migrated from: handleUpdateBooking in BookingManager
 */
async function updateBooking(req, res, next) {
  const { correlationId, tenant } = req;
  const { id: bookingId } = req.params;
  const updateData = req.body;

  // 🔍 COMPREHENSIVE PARAMETER LOGGING FOR UPDATE BOOKING
  console.log('🚀 [UPDATE BOOKING] Raw request received:', {
    correlationId,
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers?.['content-type'] || 'N/A',
      'user-agent': req.headers?.['user-agent'] || 'N/A',
      'x-correlation-id': req.headers?.['x-correlation-id'] || 'N/A'
    },
    timestamp: new Date().toISOString()
  });

  console.log('📋 [UPDATE BOOKING] Route parameters:', JSON.stringify(req.params, null, 2));
  console.log('📋 [UPDATE BOOKING] Request body analysis:', {
    bodyKeys: Object.keys(updateData || {}),
    bodySize: JSON.stringify(updateData || {}).length,
    rawBody: JSON.stringify(updateData, null, 2),
    correlationId
  });

  console.log('🔍 [UPDATE BOOKING] Parameter extraction:', {
    bookingIdFromParams: req.params.id,
    finalBookingId: bookingId,
    updateDataPresent: !!updateData,
    updateDataType: typeof updateData,
    correlationId
  });

  try {
    const result = await handleUpdateBooking(req, correlationId);

    // Success - return 200 OK with updated booking data
    res.status(200).json({
      success: true,
      data: result,
      message: 'Booking updated successfully',
      timestamp: new Date().toISOString(),
      correlationId
    });
  } catch (error) {
    // Add correlation ID to error for logging
    error.correlationId = correlationId;
    error.bookingId = bookingId;

    // Handle specific error types
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        message: error.message,
        errors: error.validationErrors,
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        ...(error.serviceError && { serviceError: error.serviceError }),
        ...(error.details && { details: error.details }),
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    // Pass unhandled errors to Express error middleware
    next(error);
  }
}

/**
 * Cancel a booking
 * Migrated from Azure Functions BookingManager
 */
async function cancelBooking(req, res) {
  const { correlationId, tenant } = req;

  // 🔍 DETAILED PARAMETER LOGGING FOR CANCEL BOOKING
  console.log('🚀 [CANCEL BOOKING] Raw request received:', {
    correlationId,
    tenantId: tenant.id,
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers?.['content-type'] || 'N/A',
      'user-agent': req.headers?.['user-agent'] || 'N/A',
      'x-correlation-id': req.headers?.['x-correlation-id'] || 'N/A'
    },
    timestamp: new Date().toISOString()
  });

  console.log('📋 [CANCEL BOOKING] Query parameters:', JSON.stringify(req.query, null, 2));
  console.log('📋 [CANCEL BOOKING] Route parameters:', JSON.stringify(req.params, null, 2));

  try {
    // EXACT AZURE FUNCTIONS LOGIC - Convert URLSearchParams to plain object if needed
    const query = req.query instanceof URLSearchParams ? Object.fromEntries(req.query.entries()) : req.query || {};

    // EXACT AZURE FUNCTIONS LOGIC - Get bookingId from query or params
    const bookingId = query.bookingId || req.params.bookingId || req.params.action;

    console.log('🔍 [CANCEL BOOKING] Parameter analysis:', {
      queryBookingId: query.bookingId,
      paramsBookingId: req.params.bookingId,
      paramsAction: req.params.action,
      finalBookingId: bookingId,
      correlationId
    });

    if (!bookingId) {
      console.log('❌ [CANCEL BOOKING] Missing booking ID');
      return res.status(400).json({
        success: false,
        message: 'bookingId is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log('📅 [CANCEL BOOKING] Starting cancellation process for booking:', bookingId);

    logEvent('booking_cancel_attempt', {
      correlationId,
      bookingId
    });

    // Create Azure Functions context for compatibility
    const context = {
      log: (...args) => logger.info(...args),
      error: (...args) => logger.error(...args)
    };

    // EXACT AZURE FUNCTIONS LOGIC - Call the shared helper with proper error handling
    const { cancelBooking: cancelBookingHelper } = require('../utils/helpers/bookingHelpers');

    console.log('🔧 [CANCEL BOOKING] Calling cancelBookingHelper with:', {
      bookingId,
      contextPresent: !!context,
      tenantId: tenant.id,
      correlationId
    });

    const result = await cancelBookingHelper(context, tenant, bookingId);

    console.log('✅ [CANCEL BOOKING] Helper function completed successfully:', {
      resultPresent: !!result,
      bookingPresent: !!(result && result.booking),
      correlationId
    });

    logEvent('booking_cancelled', {
      correlationId,
      bookingId
    });

    // EXACT AZURE FUNCTIONS PATTERN - Return the booking data
    const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
    const cleanedBooking = cleanBigIntFromObject(result.booking);

    console.log('🧹 [CANCEL BOOKING] Booking data cleaned and ready for response:', {
      originalBookingKeys: result.booking ? Object.keys(result.booking) : [],
      cleanedBookingKeys: cleanedBooking ? Object.keys(cleanedBooking) : [],
      correlationId
    });

    return res.status(200).json({
      success: true,
      data: { booking: cleanedBooking },
      message: 'Booking cancelled successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.log('❌ [CANCEL BOOKING] Error occurred:', {
      errorMessage: error.message,
      errorType: error.constructor.name,
      errorStack: error.stack,
      bookingId,
      correlationId,
      timestamp: new Date().toISOString()
    });

    logger.error('Error cancelling booking:', error);

    // EXACT AZURE FUNCTIONS ERROR HANDLING
    if (error.message && error.message.includes('not found')) {
      console.log('🔍 [CANCEL BOOKING] Booking not found error');
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message && error.message.includes('authentication failed')) {
      console.log('🔍 [CANCEL BOOKING] Authentication failed error');
      return res.status(401).json({
        success: false,
        message: 'Square API authentication failed',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🔍 [CANCEL BOOKING] Generic server error');
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get bookings for a specific customer
 * Migrated from: handleGetBookingsByCustomer in BookingManager
 */
async function getBookingsByCustomer(req, res) {
  const startTime = Date.now();
  const { correlationId, tenant } = req;
  const { id: customerId } = req.params;
  const { status, limit = 50, startDate, endDate } = req.query;

  try {
    logEvent('bookings_get_by_customer_request', {
      correlationId,
      customerId,
      status,
      limit: parseInt(limit),
      dateRange: startDate && endDate ? { startDate, endDate } : null
    });

    const result = await bookingService.getBookingsByCustomer(
      customerId,
      { status, limit: parseInt(limit), startDate, endDate },
      correlationId
    );

    if (!result.success) {
      logError('bookings_get_by_customer_failed', result.error, {
        correlationId,
        customerId,
        errorCode: result.errorCode
      });

      return sendError(res, 'Failed to retrieve customer bookings', {
        error: result.error,
        errorCode: result.errorCode
      });
    }

    logPerformance('bookings_get_by_customer_success', Date.now() - startTime, {
      correlationId,
      customerId,
      bookingCount: result.data.length
    });

    return sendSuccess(res, 'Customer bookings retrieved successfully', {
      bookings: result.data,
      total: result.data.length,
      filters: { status, limit: parseInt(limit), startDate, endDate }
    });
  } catch (error) {
    logError('bookings_get_by_customer_error', error, { correlationId, customerId });
    logPerformance('bookings_get_by_customer_error', Date.now() - startTime, { correlationId });
    return sendError(res, 'Internal server error during customer bookings retrieval');
  }
}

/**
 * Get active bookings for a specific customer
 * Migrated from: handleGetActiveBookingsByCustomer in BookingManager
 */
async function getActiveBookingsByCustomer(req, res) {
  const startTime = Date.now();
  const { correlationId, tenant } = req;
  const { id: customerId } = req.params;

  try {
    logEvent('active_bookings_get_by_customer_request', {
      correlationId,
      customerId
    });

    const result = await bookingService.getActiveBookingsByCustomer(customerId, correlationId);

    if (!result.success) {
      logError('active_bookings_get_by_customer_failed', result.error, {
        correlationId,
        customerId,
        errorCode: result.errorCode
      });

      return sendError(res, 'Failed to retrieve active customer bookings', {
        error: result.error,
        errorCode: result.errorCode
      });
    }

    logPerformance('active_bookings_get_by_customer_success', Date.now() - startTime, {
      correlationId,
      customerId,
      activeBookingCount: result.data.length
    });

    return sendSuccess(res, 'Active customer bookings retrieved successfully', {
      bookings: result.data,
      total: result.data.length
    });
  } catch (error) {
    logError('active_bookings_get_by_customer_error', error, { correlationId, customerId });
    logPerformance('active_bookings_get_by_customer_error', Date.now() - startTime, { correlationId });
    return sendError(res, 'Internal server error during active customer bookings retrieval');
  }
}

/**
 * List all bookings with filtering and pagination
 * Administrative endpoint for booking management
 */
async function listBookings(req, res) {
  const startTime = Date.now();
  const { correlationId, tenant } = req;
  const {
    status,
    staffMemberId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
    sortBy = 'startAt',
    sortOrder = 'asc'
  } = req.query;

  try {
    const filters = {
      status,
      staffMemberId,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      sortOrder
    };

    logEvent('bookings_list_request', {
      correlationId,
      filters
    });

    const result = await bookingService.listBookings(filters, correlationId);

    if (!result.success) {
      logError('bookings_list_failed', result.error, {
        correlationId,
        filters,
        errorCode: result.errorCode
      });

      return sendError(res, 'Failed to list bookings', {
        error: result.error,
        errorCode: result.errorCode
      });
    }

    logPerformance('bookings_list_success', Date.now() - startTime, {
      correlationId,
      bookingCount: result.data.bookings.length,
      totalCount: result.data.total
    });

    return sendSuccess(res, 'Bookings listed successfully', {
      bookings: result.data.bookings,
      total: result.data.total,
      filters,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: result.data.total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    logError('bookings_list_error', error, { correlationId });
    logPerformance('bookings_list_error', Date.now() - startTime, { correlationId });
    return sendError(res, 'Internal server error during bookings listing');
  }
}

/**
 * Get service availability (matches Azure Functions API)
 * GET /api/availability
 */
async function getServiceAvailability(req, res) {
  const startTime = Date.now();
  const { correlationId, tenant } = req;

  try {
    const { serviceVariationIds, staffMemberId } = req.query;
    const parsedDaysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead) : null;
    const daysAhead = parsedDaysAhead !== null && !isNaN(parsedDaysAhead) ? parsedDaysAhead : 14; // Default to 14 days

    logger.info(
      `Getting service availability - Services: ${serviceVariationIds}, ` +
        `Staff: ${staffMemberId}, Days: ${daysAhead}`
    );

    if (!serviceVariationIds) {
      return res.status(400).json({
        success: false,
        message: 'serviceVariationIds parameter is required',
        timestamp: new Date().toISOString()
      });
    }

    if (daysAhead < 1 || daysAhead > 90) {
      return res.status(400).json({
        success: false,
        message: 'daysAhead parameter must be between 1 and 90 (defaults to 14 if not provided)',
        timestamp: new Date().toISOString()
      });
    }

    // Calculate end date based on daysAhead
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + daysAhead);

    // Split serviceVariationIds string into array
    const serviceIdArray = serviceVariationIds.split(',').map(id => id.trim());

    // Debug logging for Retell integration
    console.log('🔍 [AVAILABILITY DEBUG] serviceVariationIds parameter:', serviceVariationIds);
    console.log('🔍 [AVAILABILITY DEBUG] serviceVariationIds type:', typeof serviceVariationIds);
    console.log('🔍 [AVAILABILITY DEBUG] serviceVariationIds length:', serviceVariationIds.length);
    console.log('🔍 [AVAILABILITY DEBUG] serviceIdArray:', serviceIdArray);
    console.log(
      '🔍 [AVAILABILITY DEBUG] serviceIdArray lengths:',
      serviceIdArray.map(id => ({ id, length: id.length }))
    );

    // Validate service ID lengths before processing
    for (const serviceId of serviceIdArray) {
      if (serviceId.length > 36) {
        console.log('🔍 [AVAILABILITY DEBUG] Service ID too long:', {
          serviceId,
          length: serviceId.length,
          first50chars: serviceId.substring(0, 50)
        });
        return res.status(400).json({
          success: false,
          message: `Service variation ID is too long: ${serviceId.length} characters (max 36)`,
          details: `Service ID: ${serviceId.substring(0, 50)}...`,
          timestamp: new Date().toISOString()
        });
      }
    }

    logEvent('service_availability_request', {
      correlationId,
      serviceCount: serviceIdArray.length,
      staffMemberId,
      daysAhead,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Use the availability helpers to get slots
    const availabilityHelpers = require('../utils/helpers/availabilityHelpers');

    // Create a context object similar to Azure Functions
    const context = {
      log: (...args) => logger.info(...args)
    };

    const availabilityRecord = await availabilityHelpers.loadAvailability(
      serviceIdArray,
      staffMemberId,
      startDate.toISOString(),
      endDate.toISOString(),
      context
    );

    // Clean BigInt values from the availabilityRecord BEFORE creating response
    const { cleanBigIntFromObject, bigIntReplacer } = require('../utils/helpers/bigIntUtils');
    const cleanAvailabilityRecord = cleanBigIntFromObject(availabilityRecord);

    const response = {
      id: cleanAvailabilityRecord.id,
      serviceVariationIds: cleanAvailabilityRecord.serviceVariationIds,
      staffMemberId: cleanAvailabilityRecord.staffMemberId,
      slots: cleanAvailabilityRecord.slots || [],
      timestamp: new Date().toISOString()
    };

    // Clean logging data to avoid BigInt issues
    const logData = cleanBigIntFromObject({
      serviceCount: serviceIdArray.length,
      slotsFound: response.slots?.length || 0
    });

    logPerformance(correlationId, 'service_availability', startTime, logData);

    // Clean the entire response object to remove any BigInt values
    const cleanResponse = cleanBigIntFromObject(response);

    // Create final response with cleaned data
    const responseData = {
      success: true,
      message: cleanResponse,
      data: 'Service availability retrieved successfully',
      timestamp: new Date().toISOString()
    };

    // Use custom stringify with bigIntReplacer to be extra safe
    const jsonString = JSON.stringify(responseData, bigIntReplacer);

    res.setHeader('Content-Type', 'application/json');
    return res.send(jsonString);
  } catch (error) {
    logger.error('Error in getServiceAvailability:', error);

    logPerformance(correlationId, 'service_availability_error', startTime, {
      error: error.message
    });

    return sendError(res, 'Internal server error', 500, error.message, correlationId);
  }
}

/**
 * Main booking management endpoint - EXACT COPY FROM AZURE FUNCTIONS BookingManager
 * ALL /api/booking/{action?}
 * Replaces Azure Functions BookingManager
 */
async function manageBooking(req, res) {
  const { correlationId, tenant } = req;

  // EXACT AZURE FUNCTIONS LOGIC - Get action from params or determine from method
  const action = req.params.action || getActionFromMethod(req.method);

  // 🔍 DETAILED LOGGING FOR RETELL DEBUGGING (MANAGE BOOKING)
  console.log('🚀 [MANAGE BOOKING] Request received:', {
    correlationId,
    action,
    method: req.method,
    url: req.url,
    params: req.params,
    query: req.query,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-correlation-id': req.headers['x-correlation-id']
    },
    bodyKeys: Object.keys(req.body || {}),
    timestamp: new Date().toISOString()
  });

  logger.info('📅 BookingManager function invoked', {
    correlationId,
    action,
    method: req.method,
    query: req.query,
    params: req.params
  });

  try {
    let result;

    // EXACT AZURE FUNCTIONS ROUTING LOGIC
    switch (action) {
      case 'create':
        result = await handleCreateBooking(req, correlationId);
        break;
      case 'update':
        result = await handleUpdateBooking(req, correlationId);
        break;
      case 'cancel':
      case 'delete':
        result = await handleCancelBooking(req, correlationId);
        break;
      case 'get':
        result = await handleGetBooking(req, correlationId);
        break;
      case 'list':
        result = await handleListBookings(req, correlationId);
        break;
      default:
        // Check if action is actually a booking ID
        if (action && action.length > 10) {
          // This is a booking ID, determine action from HTTP method
          const methodAction = getActionFromMethod(req.method);

          // Set bookingId in params for the handlers
          req.params.bookingId = action;
          req.query.bookingId = action;

          switch (methodAction) {
            case 'get':
              result = await handleGetBooking(req, correlationId);
              break;
            case 'cancel':
            case 'delete':
              result = await handleCancelBooking(req, correlationId);
              break;
            case 'update':
              result = await handleUpdateBooking(req, correlationId);
              break;
            default:
              return res.status(400).json({
                success: false,
                message: `Unsupported method ${req.method} for booking ID`,
                timestamp: new Date().toISOString(),
                correlationId
              });
          }
        } else {
          return res.status(400).json({
            success: false,
            message: `Invalid action: ${action}. Valid actions: create, update, cancel, get, list`,
            timestamp: new Date().toISOString(),
            correlationId
          });
        }
    }

    // Return the result
    return res.status(result.statusCode || 200).json(result);
  } catch (error) {
    logger.error('Error in manageBooking:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId
    });
  }
}

// EXACT AZURE FUNCTIONS HELPER FUNCTIONS
function getActionFromMethod(method) {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'GET':
      return 'get';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'cancel';
    default:
      return 'unknown';
  }
}

async function handleCancelBooking(req, correlationId) {
  // EXACT AZURE FUNCTIONS LOGIC
  const query = req.query instanceof URLSearchParams ? Object.fromEntries(req.query.entries()) : req.query || {};
  const bookingId = query.bookingId || req.params.bookingId || req.params.action;

  if (!bookingId) {
    return {
      success: false,
      message: 'bookingId is required',
      timestamp: new Date().toISOString(),
      statusCode: 400,
      correlationId
    };
  }

  try {
    // Create Azure Functions context for compatibility
    const context = {
      log: (...args) => logger.info(...args),
      error: (...args) => logger.error(...args)
    };

    // EXACT AZURE FUNCTIONS LOGIC - Call the shared helper
    const { cancelBooking: cancelBookingHelper } = require('../utils/helpers/bookingHelpers');
    const result = await cancelBookingHelper(context, bookingId);

    // IMMEDIATELY clean BigInt values before processing
    const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
    const cleanedResult = cleanBigIntFromObject(result);

    return {
      success: true,
      data: { booking: cleanedResult.booking },
      message: 'Booking cancelled successfully',
      timestamp: new Date().toISOString(),
      statusCode: 200,
      correlationId
    };
  } catch (error) {
    logger.error('Error in handleCancelBooking:', error);
    return {
      success: false,
      message: 'Failed to cancel booking',
      error: error.message,
      timestamp: new Date().toISOString(),
      statusCode: 500,
      correlationId
    };
  }
}

async function handleGetBooking(req, correlationId) {
  // EXACT AZURE FUNCTIONS LOGIC
  const query = req.query instanceof URLSearchParams ? Object.fromEntries(req.query.entries()) : req.query || {};
  const bookingId = query.bookingId || req.params.bookingId || req.params.action;

  if (!bookingId) {
    return {
      success: false,
      message: 'bookingId is required',
      timestamp: new Date().toISOString(),
      statusCode: 400,
      correlationId
    };
  }

  try {
    // Create Azure Functions context for compatibility
    const context = {
      log: (...args) => logger.info(...args),
      error: (...args) => logger.error(...args)
    };

    // EXACT AZURE FUNCTIONS LOGIC - Call the shared helper
    const { getBooking: getBookingHelper } = require('../utils/helpers/bookingHelpers');
    const result = await getBookingHelper(context, bookingId);

    // IMMEDIATELY clean BigInt values before processing
    const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
    const cleanedResult = cleanBigIntFromObject(result);

    return {
      success: true,
      data: { booking: cleanedResult.booking },
      message: 'Booking retrieved successfully',
      timestamp: new Date().toISOString(),
      statusCode: 200,
      correlationId
    };
  } catch (error) {
    logger.error('Error in handleGetBooking:', error);
    return {
      success: false,
      message: 'Failed to retrieve booking',
      error: error.message,
      timestamp: new Date().toISOString(),
      statusCode: 500,
      correlationId
    };
  }
}

// EXACT AZURE FUNCTIONS HANDLERS - Copy the exact same logic
async function handleCreateBooking(req, correlationId) {
  const { tenant } = req;

  // 🔍 DETAILED PARAMETER LOGGING FOR RETELL DEBUGGING (HANDLE CREATE)
  console.log('🚀 [HANDLE CREATE BOOKING] Raw request received:', {
    correlationId,
    tenantId: tenant.id,
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-correlation-id': req.headers['x-correlation-id']
    },
    timestamp: new Date().toISOString()
  });

  const bookingData = req.body;
  console.log('📋 [HANDLE CREATE BOOKING] Request body (raw):', JSON.stringify(bookingData, null, 2));

  console.log('🔍 [HANDLE CREATE BOOKING] Parameter analysis:', {
    bodyType: typeof bookingData,
    bodyKeys: Object.keys(bookingData || {}),
    bodyLength: JSON.stringify(bookingData).length,
    hasCustomerId: !!bookingData?.customerId,
    hasAppointmentSegments: !!bookingData?.appointmentSegments,
    appointmentSegmentsType: typeof bookingData?.appointmentSegments,
    appointmentSegmentsLength: Array.isArray(bookingData?.appointmentSegments)
      ? bookingData.appointmentSegments.length
      : 'not-array',
    hasStartAt: !!bookingData?.startAt,
    correlationId
  });

  try {
    const bookingData = req.body;
    const result = await createBookingCore(tenant, bookingData, correlationId);

    // Success - convert to Azure Functions format
    return {
      success: true,
      message: 'Booking created successfully',
      data: result,
      timestamp: new Date().toISOString(),
      statusCode: 201,
      correlationId
    };
  } catch (error) {
    // Convert Express-style errors to Azure Functions format
    return {
      success: false,
      message: error.message,
      error: error.message,
      ...(error.validationErrors && { errors: error.validationErrors }),
      ...(error.code && { code: error.code }),
      ...(error.conflictingBookings && { conflictingBookings: error.conflictingBookings }),
      timestamp: new Date().toISOString(),
      statusCode: error.statusCode || 500,
      correlationId
    };
  }
}

async function handleUpdateBooking(req, correlationId) {
  const { tenant } = req;

  try {
    // Extract bookingId from query params or route params
    const bookingId = req.query.bookingId || req.params.bookingId || req.params.id || req.params.action;
    let updateData = req.body;

    console.log('🔍 [HANDLE UPDATE BOOKING] BookingId extraction:', {
      queryBookingId: req.query.bookingId,
      paramsBookingId: req.params.bookingId,
      paramsAction: req.params.action,
      finalBookingId: bookingId,
      tenantId: tenant.id,
      correlationId
    });

    // Validate bookingId is present
    if (!bookingId) {
      console.log('❌ [HANDLE UPDATE BOOKING] Missing booking ID');
      throw new Error('bookingId is required');
    }

    // Handle nested request structure from agents/tools
    if (updateData.args) {
      console.log('🔧 [HANDLE UPDATE BOOKING] Extracting args from nested structure');
      updateData = updateData.args;
    }

    // Extract the specific parameters that updateBookingCore expects
    const { startAt, note, customerId, customerNote, endAt, version, appointmentSegments, bookingSegments } =
      updateData;

    // Handle both appointmentSegments and bookingSegments (agent might send either)
    const segments = appointmentSegments || bookingSegments;

    console.log('🚀 [HANDLE UPDATE BOOKING] Processing request:', {
      correlationId,
      bookingId,
      originalBodyKeys: Object.keys(req.body || {}),
      updateData: JSON.stringify(updateData, null, 2),
      extractedParams: { startAt, note, customerId, customerNote, endAt, version },
      hasAppointmentSegments: !!appointmentSegments,
      hasBookingSegments: !!bookingSegments,
      finalSegments: segments
    });

    const result = await updateBookingCore(tenant, bookingId, startAt, note, customerId, customerNote, endAt, segments);

    // Success - convert to Azure Functions format
    return {
      success: true,
      message: 'Booking updated successfully',
      data: result,
      timestamp: new Date().toISOString(),
      statusCode: 200,
      correlationId
    };
  } catch (error) {
    console.error('❌ [HANDLE UPDATE BOOKING] Error:', error);
    // Convert Express-style errors to Azure Functions format
    return {
      success: false,
      message: error.message,
      error: error.message,
      ...(error.validationErrors && { errors: error.validationErrors }),
      ...(error.code && { code: error.code }),
      ...(error.serviceError && { serviceError: error.serviceError }),
      ...(error.details && { details: error.details }),
      timestamp: new Date().toISOString(),
      statusCode: error.statusCode || 500,
      correlationId
    };
  }
}

async function handleListBookings(req, correlationId) {
  // Call the existing listBookings function - need to handle response differently
  try {
    const result = await listBookings(req, {
      json: data => data,
      status: code => ({ json: data => ({ ...data, statusCode: code }) })
    });
    return result;
  } catch (error) {
    return {
      success: false,
      message: 'Failed to list bookings',
      error: error.message,
      timestamp: new Date().toISOString(),
      statusCode: 500,
      correlationId
    };
  }
}

module.exports = {
  // Booking operations
  createBooking,
  updateBooking,
  cancelBooking,

  // Customer booking operations
  getBookingsByCustomer,
  getActiveBookingsByCustomer,

  // Administrative operations
  listBookings,

  // Availability operations
  getServiceAvailability,

  // Main API operations
  manageBooking
};
