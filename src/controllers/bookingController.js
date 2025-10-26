/**
 * Booking Controller
 * Comprehensive booking operations for Square API
 * Multi-tenant enabled with header-based authentication
 */

const { sendSuccess, sendError } = require('../utils/responseBuilder');
const { logPerformance, logEvent, logError, logger } = require('../utils/logger');
const bookingService = require('../services/bookingService');
const agentBookingService = require('../services/agentBookingService');
const bookingAvailabilityService = require('../services/bookingAvailabilityService');
const bookingManagementService = require('../services/bookingManagementService');
const {
  validateBookingData,
  cancelBooking: cancelBookingHelper
} = require('../utils/helpers/bookingHelpers');
const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
const { checkSlotAvailability, checkCustomerConflicts } = require('../utils/helpers/bookingValidationHelpers');
const { generateCorrelationId } = require('../utils/security');
const { stripRetellMeta } = require('../utils/retellPayload');
const { createSquareClient } = require('../utils/squareUtils');

/**
 * Enforce booking ownership constraints for tenants without seller-level writes.
 * Throws an error if the booking was not created by the current agent.
 * @param {Object} tenant - Tenant context.
 * @param {string} bookingId - Square booking ID.
 */
async function ensureAgentCanModifyBooking(tenant, bookingId) {
  if (!tenant || tenant.supportsSellerLevelWrites !== false) {
    return;
  }

  const agentId = tenant.agentId || tenant.id;
  if (!agentId) {
    throw {
      message: 'Agent context missing. Unable to verify booking ownership.',
      code: 'AGENT_CONTEXT_MISSING',
      status: 500,
      statusCode: 500
    };
  }

  const isOwned = await agentBookingService.isAgentBooking(agentId, bookingId);

  if (!isOwned) {
    throw {
      message:
        'This Square account is on the free Appointments plan. Agents can only modify bookings they created. Please upgrade to Appointments Plus or Premium for full calendar management.',
      code: 'SELLER_LEVEL_WRITES_REQUIRED',
      status: 403,
      statusCode: 403
    };
  }
}

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
  try {
    // Create tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    const availabilityResult = await checkSlotAvailability(
      square,
      tenant,
      bookingData.startAt,
      bookingData.appointmentSegments
    );

    if (!availabilityResult.isAvailable) {
      throw {
        message: availabilityResult.error,
        code: availabilityResult.code,
        status: 409,
        details: {
          availableSlots: availabilityResult.availableSlots
        }
      };
    }
  } catch (availabilityError) {
    if (availabilityError.statusCode) {
      // Re-throw HTTP errors (SLOT_UNAVAILABLE)
      throw availabilityError;
    }
    logger.error('⚠️ [AVAILABILITY CHECK] Error checking slot availability:', availabilityError.message);
    // Continue with booking creation despite availability check error
    // The Square API will reject it if truly unavailable
  }

  // ✅ CUSTOMER BOOKING CONFLICT CHECK
  // Check if customer already has a booking at the requested time
  if (bookingData.customerId) {
    try {
      const square = createSquareClient(
        tenant.accessToken || tenant.squareAccessToken,
        tenant.squareEnvironment || tenant.environment || 'production'
      );

      const conflictResult = await checkCustomerConflicts(
        square,
        bookingData.customerId,
        bookingData.startAt
      );

      if (conflictResult.hasConflict) {
        throw {
          message: conflictResult.error,
          code: conflictResult.code,
          status: 409,
          details: {
            conflictingBookings: conflictResult.conflictingBookings
          }
        };
      }
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

  const createdBooking = result.data.booking || {};
  const createdBookingId = createdBooking.id || result.data.id || bookingData?.id || null;

  logEvent('booking_create_success', {
    correlationId,
    bookingId: createdBookingId,
    customerId: bookingData.customerId
  });

  logEvent('booking_create_complete', {
    correlationId,
    bookingId: createdBookingId,
    customerId: bookingData.customerId
  });

  // Persist agent ownership record for free-tier enforcement and analytics
  try {
    await agentBookingService.upsertAgentBooking({
      agentId: tenant.agentId || tenant.id,
      tenantId: tenant.id || tenant.agentId,
      locationId: (tenant.locationId || tenant.squareLocationId || bookingData.locationId || null) ?? null,
      merchantId: tenant.squareMerchantId || tenant.merchantId || null,
      booking: createdBooking
    });
  } catch (recordError) {
    logger.warn('Failed to persist agent booking record', {
      correlationId,
      bookingId: createdBookingId,
      message: recordError.message
    });
  }

  // Return the booking data
  return {
    booking: createdBooking
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
    const result = await bookingManagementService.handleUpdateBooking(
      req,
      correlationId,
      updateBookingCore,
      ensureAgentCanModifyBooking
    );

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

    await ensureAgentCanModifyBooking(tenant, bookingId);

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

    try {
      await agentBookingService.removeAgentBooking(bookingId);
    } catch (ledgerError) {
      logger.warn('Failed to remove agent booking ledger entry (direct handler)', {
        correlationId,
        bookingId,
        message: ledgerError.message
      });
    }

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
/**
 * Get service availability
 * Delegates to bookingAvailabilityService for parameter parsing, validation, and availability lookup
 */
async function getServiceAvailability(req, res) {
  const { correlationId, tenant } = req;

  try {
    const result = await bookingAvailabilityService.getServiceAvailability(req, tenant, correlationId);

    if (result.status !== 200) {
      return res.status(result.status).json(result.data);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.send(result.jsonString);
  } catch (error) {
    logger.error('Error in getServiceAvailability:', error);
    return sendError(res, 'Internal server error', 500, error.message, correlationId);
  }
}

/**
 * Main booking management endpoint - EXACT COPY FROM AZURE FUNCTIONS BookingManager
 * ALL /api/booking/{action?}
 * Replaces Azure Functions BookingManager
 * Delegates to bookingManagementService for request routing and handling
 */
async function manageBooking(req, res) {
  const { correlationId } = req;

  try {
    // Delegate to management service with all required functions
    await bookingManagementService.manageBooking(req, res, {
      createBookingCore,
      updateBookingCore,
      listBookings,
      ensureAgentCanModifyBooking
    });
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
