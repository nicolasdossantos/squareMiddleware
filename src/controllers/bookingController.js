/**
 * Booking Controller
 * Comprehensive booking operations for Square API
 * Multi-tenant enabled with header-based authentication
 */

const { sendSuccess, sendError } = require('../utils/responseBuilder');
const { logPerformance, logEvent, logError, logger } = require('../utils/logger');
const bookingService = require('../services/bookingService');
const {
  validateBookingData,
  cancelBooking: cancelBookingHelper,
  getBooking: getBookingHelper
} = require('../utils/helpers/bookingHelpers');
const availabilityHelpers = require('../utils/helpers/availabilityHelpers');
const { cleanBigIntFromObject, bigIntReplacer } = require('../utils/helpers/bigIntUtils');
const { generateCorrelationId } = require('../utils/security');
const { stripRetellMeta, parseMaybeJson } = require('../utils/retellPayload');
const { createSquareClient } = require('../utils/squareUtils');

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
    throw {
      message: 'Invalid booking data',
      code: 'VALIDATION_ERROR',
      status: 400,
      details: validationResult.errors
    };
  }

  // ✅ SLOT AVAILABILITY CHECK
  // Verify the requested time slot is still available before creating booking
  logger.info('🔍 [AVAILABILITY CHECK] Verifying slot is still available...', {
    startAt: bookingData.startAt,
    appointmentSegments: bookingData.appointmentSegments?.length,
    correlationId
  });

  try {
    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

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

      throw {
        message: 'The requested time slot is no longer available. Please select a different time.',
        code: 'SLOT_UNAVAILABLE',
        status: 409,
        details: {
          availableSlots: availableSlots.slice(0, 10).map(s => ({
            startAt: s.startAt,
            appointmentSegments: s.appointmentSegments
          }))
        }
      };
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
      // Get customer's existing bookings around the requested time (±30 minutes)
      const bufferMinutes = 30;
      const requestedStartTime = new Date(bookingData.startAt);
      const searchStart = new Date(requestedStartTime.getTime() - bufferMinutes * 60 * 1000);
      const searchEnd = new Date(requestedStartTime.getTime() + bufferMinutes * 60 * 1000);

      const existingBookingsResponse = await square.bookingsApi.listBookings({
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

        throw {
          message: 'Customer already has an appointment at this time. Please select a different time slot.',
          code: 'BOOKING_CONFLICT',
          status: 409,
          details: {
            conflictingBookings: cleanBigIntFromObject(
              conflictingBookings.map(b => ({
                id: b.id,
                startAt: b.startAt,
                status: b.status
              }))
            )
          }
        };
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

    throw {
      message: 'Failed to create booking',
      code: 'BOOKING_CREATION_FAILED',
      status: 500,
      details: result.error || 'Booking creation failed'
    };
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
  const bookingDataRaw = req.body || {};
  const bookingData = stripRetellMeta(bookingDataRaw);

  // 🔍 DETAILED PARAMETER LOGGING FOR RETELL DEBUGGING
  logger.info('🚀 [BOOKING CREATE] Raw request received:', {
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

  logger.info('📋 [BOOKING CREATE] Request body (raw):', JSON.stringify(bookingDataRaw, null, 2));
  logger.info('📋 [BOOKING CREATE] Normalized payload:', JSON.stringify(bookingData, null, 2));

  logger.info('🔍 [BOOKING CREATE] Parameter analysis:', {
    bodyType: typeof bookingDataRaw,
    bodyKeys: Object.keys(bookingDataRaw || {}),
    bodyLength: JSON.stringify(bookingDataRaw).length,
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
    logger.info(
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
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        ...(error.conflictingBookings && {
          conflictingBookings: cleanBigIntFromObject(error.conflictingBookings)
        }),
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
  logger.info('🚀 [UPDATE BOOKING CORE] Function called with parameters:', {
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
    logger.info('❌ [UPDATE BOOKING CORE] Missing required parameter: bookingId');
    throw {
      message: 'bookingId is required',
      code: 'MISSING_BOOKING_ID',
      status: 400
    };
  }

  // Validate startAt if provided
  if (startAt && safeDateToISO(startAt) === 'Invalid Date') {
    logger.info('❌ [UPDATE BOOKING CORE] Invalid startAt date:', startAt);
    throw {
      message: 'Invalid time value for startAt',
      code: 'INVALID_START_TIME',
      status: 400,
      details: { provided: startAt }
    };
  }

  // Validate endAt if provided
  if (endAt && safeDateToISO(endAt) === 'Invalid Date') {
    logger.info('❌ [UPDATE BOOKING CORE] Invalid endAt date:', endAt);
    throw {
      message: 'Invalid time value for endAt',
      code: 'INVALID_END_TIME',
      status: 400,
      details: { provided: endAt }
    };
  }

  logger.info('📅 [UPDATE BOOKING CORE] Starting update process for booking:', bookingId);

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

    logger.info('🚀 [UPDATE BOOKING CORE] Calling booking service with:', updateData);
    // Call the booking service with tenant context
    const result = await bookingService.updateBooking(tenant, bookingId, updateData, correlationId);
    logger.info('✅ [UPDATE BOOKING CORE] Booking service response:', result);
    return result;
  } catch (error) {
    logger.error('❌ [UPDATE BOOKING CORE] Error calling booking service:', error.message || error);
    throw {
      message: error.message || 'Failed to update booking',
      code: error.code || 'UPDATE_FAILED',
      status: error.status || error.statusCode || 500,
      details: error.details
    };
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
  logger.info('🚀 [UPDATE BOOKING] Raw request received:', {
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

  logger.info('📋 [UPDATE BOOKING] Route parameters:', JSON.stringify(req.params, null, 2));
  logger.info('📋 [UPDATE BOOKING] Request body analysis:', {
    bodyKeys: Object.keys(updateData || {}),
    bodySize: JSON.stringify(updateData || {}).length,
    rawBody: JSON.stringify(updateData, null, 2),
    correlationId
  });

  logger.info('🔍 [UPDATE BOOKING] Parameter extraction:', {
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
  logger.info('🚀 [CANCEL BOOKING] Raw request received:', {
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

  logger.info('📋 [CANCEL BOOKING] Query parameters:', JSON.stringify(req.query, null, 2));
  logger.info('📋 [CANCEL BOOKING] Route parameters:', JSON.stringify(req.params, null, 2));

  try {
    // EXACT AZURE FUNCTIONS LOGIC - Convert URLSearchParams to plain object if needed
    const query =
      req.query instanceof URLSearchParams ? Object.fromEntries(req.query.entries()) : req.query || {};

    // Get bookingId from route params (DELETE /api/bookings/:bookingId)
    const bookingId = req.params.bookingId || req.params.id || query.bookingId;

    logger.info('🔍 [CANCEL BOOKING] Parameter analysis:', {
      queryBookingId: query.bookingId,
      paramsBookingId: req.params.bookingId,
      paramsId: req.params.id,
      allParams: req.params,
      finalBookingId: bookingId,
      correlationId
    });

    if (!bookingId) {
      logger.info('❌ [CANCEL BOOKING] Missing booking ID');
      return res.status(400).json({
        success: false,
        message: 'bookingId is required',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('📅 [CANCEL BOOKING] Starting cancellation process for booking:', bookingId);

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

    logger.info('🔧 [CANCEL BOOKING] Calling cancelBookingHelper with:', {
      bookingId,
      contextPresent: !!context,
      tenantId: tenant.id,
      correlationId
    });

    const result = await cancelBookingHelper(context, tenant, bookingId);

    logger.info('✅ [CANCEL BOOKING] Helper function completed successfully:', {
      resultPresent: !!result,
      bookingPresent: !!(result && result.booking),
      correlationId
    });

    logEvent('booking_cancelled', {
      correlationId,
      bookingId
    });

    // EXACT AZURE FUNCTIONS PATTERN - Return the booking data
    const cleanedBooking = cleanBigIntFromObject(result.booking);

    logger.info('🧹 [CANCEL BOOKING] Booking data cleaned and ready for response:', {
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
    logger.info('❌ [CANCEL BOOKING] Error occurred:', {
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
      logger.info('🔍 [CANCEL BOOKING] Booking not found error');
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message && error.message.includes('authentication failed')) {
      logger.info('🔍 [CANCEL BOOKING] Authentication failed error');
      return res.status(401).json({
        success: false,
        message: 'Square API authentication failed',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🔍 [CANCEL BOOKING] Generic server error');
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

    const result = await bookingService.getBookingsByCustomer(tenant, customerId, correlationId);

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
    cursor, // Pagination cursor from Square API
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
      cursor, // Pass cursor for pagination
      sortBy,
      sortOrder
    };

    logEvent('bookings_list_request', {
      correlationId,
      filters
    });

    const result = await bookingService.listBookings(filters, tenant, correlationId);

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
      count: result.data.bookings.length, // Number of bookings in this page
      filters,
      pagination: {
        limit: parseInt(limit),
        cursor: result.data.cursor, // Next page cursor from Square
        hasMore: !!result.data.cursor // Has more if cursor exists
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
    const rawServiceIds =
      req.query.serviceVariationIds ??
      req.query.serviceIds ??
      req.body?.serviceVariationIds ??
      req.body?.serviceIds ??
      req.body?.service_variation_ids ??
      req.retellPayload?.serviceVariationIds ??
      req.retellPayload?.service_variation_ids;

    const rawStaffId =
      req.query.staffMemberId ??
      req.query.staffId ??
      req.body?.staffMemberId ??
      req.body?.staffId ??
      req.body?.staff_member_id ??
      req.retellPayload?.staffMemberId ??
      req.retellPayload?.staffId ??
      req.retellPayload?.staff_member_id;

    const rawDaysAhead =
      req.query.daysAhead ??
      req.body?.daysAhead ??
      req.body?.days_ahead ??
      req.retellPayload?.daysAhead ??
      req.retellPayload?.days_ahead;

    let serviceIdArray = [];
    if (Array.isArray(rawServiceIds)) {
      serviceIdArray = rawServiceIds.map(id => String(id).trim()).filter(Boolean);
    } else if (typeof rawServiceIds === 'string') {
      const parsedIds = parseMaybeJson(rawServiceIds);
      if (Array.isArray(parsedIds)) {
        serviceIdArray = parsedIds.map(id => String(id).trim()).filter(Boolean);
      } else {
        serviceIdArray = rawServiceIds
          .split(',')
          .map(id => id.trim())
          .filter(Boolean);
      }
    }

    if (!serviceIdArray.length) {
      return res.status(400).json({
        success: false,
        message: 'serviceVariationIds parameter is required',
        timestamp: new Date().toISOString()
      });
    }

    let staffMemberId;
    if (rawStaffId) {
      const parsedStaff = typeof rawStaffId === 'string' ? parseMaybeJson(rawStaffId) : rawStaffId;
      staffMemberId = Array.isArray(parsedStaff) ? String(parsedStaff[0]).trim() : String(parsedStaff).trim();
    }

    const parsedDaysAhead =
      rawDaysAhead !== undefined && rawDaysAhead !== null ? parseInt(rawDaysAhead, 10) : null;
    // Default to 14 days
    const daysAhead = parsedDaysAhead !== null && !Number.isNaN(parsedDaysAhead) ? parsedDaysAhead : 14;

    logger.info(
      `Getting service availability - Services: ${serviceIdArray.join(',')}, ` +
        `Staff: ${staffMemberId}, Days: ${daysAhead}`
    );

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

    // Debug logging for Retell integration
    logger.info('🔍 [AVAILABILITY DEBUG] serviceVariationIds parameter:', rawServiceIds);
    logger.info(
      '🔍 [AVAILABILITY DEBUG] serviceVariationIds type:',
      Array.isArray(rawServiceIds) ? 'array' : typeof rawServiceIds
    );
    logger.info(
      '🔍 [AVAILABILITY DEBUG] serviceVariationIds length:',
      Array.isArray(rawServiceIds) ? rawServiceIds.length : String(rawServiceIds || '').length
    );
    logger.info('🔍 [AVAILABILITY DEBUG] serviceIdArray:', serviceIdArray);
    logger.info(
      '🔍 [AVAILABILITY DEBUG] serviceIdArray lengths:',
      serviceIdArray.map(id => ({ id, length: id.length }))
    );

    // Validate service ID lengths before processing
    for (const serviceId of serviceIdArray) {
      if (serviceId.length > 36) {
        logger.info('🔍 [AVAILABILITY DEBUG] Service ID too long:', {
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

    // Create a context object similar to Azure Functions
    const context = {
      log: (...args) => logger.info(...args)
    };

    const availabilityRecord = await availabilityHelpers.loadAvailability(
      tenant,
      serviceIdArray,
      staffMemberId,
      startDate.toISOString(),
      endDate.toISOString(),
      context
    );

    // Clean BigInt values from the availabilityRecord BEFORE creating response
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
  const action = req.params.action || req.body?.action || getActionFromMethod(req.method);

  // 🔍 DETAILED LOGGING FOR RETELL DEBUGGING (MANAGE BOOKING)
  logger.info('🚀 [MANAGE BOOKING] Request received:', {
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
  const { tenant } = req || {};
  const query =
    req.query instanceof URLSearchParams ? Object.fromEntries(req.query.entries()) : req.query || {};
  const body = req.body || {};
  const bookingId =
    query.bookingId || req.params.bookingId || req.params.action || body.bookingId || body.booking_id;

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
    if (!tenant) {
      throw new Error('Tenant context is required to cancel a booking');
    }

    // Create Azure Functions context for compatibility
    const context = {
      log: (...args) => logger.info(...args),
      error: (...args) => logger.error(...args)
    };

    // EXACT AZURE FUNCTIONS LOGIC - Call the shared helper
    const result = await cancelBookingHelper(context, tenant, bookingId);

    // IMMEDIATELY clean BigInt values before processing
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
  const query =
    req.query instanceof URLSearchParams ? Object.fromEntries(req.query.entries()) : req.query || {};
  const body = req.body || {};
  const bookingId =
    query.bookingId || req.params.bookingId || req.params.action || body.bookingId || body.booking_id;

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
    const result = await getBookingHelper(context, bookingId);

    // IMMEDIATELY clean BigInt values before processing
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
  logger.info('🚀 [HANDLE CREATE BOOKING] Raw request received:', {
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

  const bookingDataRaw = req.body || {};
  const bookingData = stripRetellMeta(bookingDataRaw);
  logger.info('📋 [HANDLE CREATE BOOKING] Request body (raw):', JSON.stringify(bookingDataRaw, null, 2));
  logger.info('📋 [HANDLE CREATE BOOKING] Normalized payload:', JSON.stringify(bookingData, null, 2));

  logger.info('🔍 [HANDLE CREATE BOOKING] Parameter analysis:', {
    bodyType: typeof bookingDataRaw,
    bodyKeys: Object.keys(bookingDataRaw || {}),
    bodyLength: JSON.stringify(bookingDataRaw).length,
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
    let updateData = stripRetellMeta(req.body || {});

    logger.info('🔍 [HANDLE UPDATE BOOKING] BookingId extraction:', {
      queryBookingId: req.query.bookingId,
      paramsBookingId: req.params.bookingId,
      paramsAction: req.params.action,
      finalBookingId: bookingId,
      tenantId: tenant.id,
      correlationId
    });

    // Validate bookingId is present
    if (!bookingId) {
      logger.info('❌ [HANDLE UPDATE BOOKING] Missing booking ID');
      throw {
        message: 'bookingId is required',
        code: 'MISSING_BOOKING_ID',
        status: 400
      };
    }

    // Handle nested request structure from agents/tools
    if (updateData.args) {
      logger.info('🔧 [HANDLE UPDATE BOOKING] Extracting args from nested structure');
      updateData = stripRetellMeta(updateData.args);
    }

    // Extract the specific parameters that updateBookingCore expects
    const { startAt, note, customerId, customerNote, endAt, version, appointmentSegments, bookingSegments } =
      updateData;

    // Handle both appointmentSegments and bookingSegments (agent might send either)
    const segments = appointmentSegments || bookingSegments;

    logger.info('🚀 [HANDLE UPDATE BOOKING] Processing request:', {
      correlationId,
      bookingId,
      originalBodyKeys: Object.keys(req.body || {}),
      updateData: JSON.stringify(updateData, null, 2),
      extractedParams: { startAt, note, customerId, customerNote, endAt, version },
      hasAppointmentSegments: !!appointmentSegments,
      hasBookingSegments: !!bookingSegments,
      finalSegments: segments
    });

    const result = await updateBookingCore(
      tenant,
      bookingId,
      startAt,
      note,
      customerId,
      customerNote,
      endAt,
      segments
    );

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
    logger.error('❌ [HANDLE UPDATE BOOKING] Error:', error);
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

/**
 * Get booking by ID
 * GET /api/bookings/:bookingId
 */
async function getBooking(req, res) {
  const { correlationId, tenant } = req;
  const { bookingId } = req.params;

  try {
    logEvent('booking_get_request', { correlationId, bookingId });

    const result = await bookingService.getBooking(tenant, bookingId, correlationId);

    if (!result.success) {
      logError('booking_get_failed', result.error, { correlationId, bookingId });
      return sendError(res, 'Failed to retrieve booking', { error: result.error });
    }

    logEvent('booking_get_success', { correlationId, bookingId });
    return sendSuccess(res, 'Booking retrieved successfully', result.data);
  } catch (error) {
    logError('booking_get_error', error, { correlationId, bookingId });
    return sendError(res, 'Failed to retrieve booking');
  }
}

/**
 * Confirm booking (update status to ACCEPTED)
 * POST /api/bookings/:bookingId/confirm
 */
async function confirmBooking(req, res) {
  const { correlationId, tenant } = req;
  const { bookingId } = req.params;

  try {
    logEvent('booking_confirm_request', { correlationId, bookingId });

    const result = await bookingService.confirmBooking(tenant, bookingId, correlationId);

    if (!result.success) {
      logError('booking_confirm_failed', result.error, { correlationId, bookingId });
      return sendError(res, 'Failed to confirm booking', { error: result.error });
    }

    logEvent('booking_confirm_success', { correlationId, bookingId });
    return sendSuccess(res, 'Booking confirmed successfully', { booking: result.data });
  } catch (error) {
    logError('booking_confirm_error', error, { correlationId, bookingId });
    return sendError(res, 'Internal server error during booking confirmation');
  }
}

module.exports = {
  // Booking operations
  createBooking,
  updateBooking,
  cancelBooking,
  getBooking,
  confirmBooking,

  // Customer booking operations
  getBookingsByCustomer,
  getCustomerBookings: getBookingsByCustomer, // Alias for route compatibility
  getActiveBookingsByCustomer,
  getCustomerActiveBookings: getActiveBookingsByCustomer, // Alias for route compatibility

  // Administrative operations
  listBookings,

  // Availability operations
  getServiceAvailability,

  // Main API operations
  manageBooking
};
