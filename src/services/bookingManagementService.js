/**
 * Booking Management Service
 * Extracted from BookingController to handle Azure Functions-style routing
 * and wrapper logic for booking operations
 *
 * This service handles:
 * - Action routing (create, update, cancel, get, list)
 * - Parameter extraction from different request formats
 * - Azure Functions-style response formatting
 * - Agent booking ledger updates after operations
 */

const { logger, logEvent, logError } = require('../utils/logger');
const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
const {
  cancelBooking: cancelBookingHelper,
  getBooking: getBookingHelper
} = require('../utils/helpers/bookingHelpers');
const agentBookingService = require('./agentBookingService');
const { stripRetellMeta } = require('../utils/retellPayload');

/**
 * Determine action from HTTP method
 * Used when action is not explicitly specified
 */
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

/**
 * Handle cancel booking request (Azure Functions format)
 * Extracted from manageBooking handler
 */
async function handleCancelBooking(req, correlationId, ensureAgentCanModifyBooking) {
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

    await ensureAgentCanModifyBooking(tenant, bookingId);

    // Create Azure Functions context for compatibility
    const context = {
      log: (...args) => logger.info(...args),
      error: (...args) => logger.error(...args)
    };

    // Call the shared helper
    const result = await cancelBookingHelper(context, tenant, bookingId);

    // Clean BigInt values before processing
    const cleanedResult = cleanBigIntFromObject(result);

    try {
      await agentBookingService.removeAgentBooking(bookingId);
    } catch (ledgerError) {
      logger.warn('Failed to remove agent booking ledger entry', {
        correlationId,
        bookingId,
        message: ledgerError.message
      });
    }

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

/**
 * Handle get booking request (Azure Functions format)
 * Extracted from manageBooking handler
 */
async function handleGetBooking(req, correlationId) {
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

    // Call the shared helper
    const result = await getBookingHelper(context, bookingId);

    // Clean BigInt values before processing
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

/**
 * Handle create booking request (Azure Functions format)
 * Extracted from manageBooking handler
 */
async function handleCreateBooking(req, correlationId, createBookingCore) {
  const { tenant } = req;

  const bookingDataRaw = req.body || {};
  const bookingData = stripRetellMeta(bookingDataRaw);

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

/**
 * Handle update booking request (Azure Functions format)
 * Extracted from manageBooking handler
 */
async function handleUpdateBooking(req, correlationId, updateBookingCore, ensureAgentCanModifyBooking) {
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

    await ensureAgentCanModifyBooking(tenant, bookingId);

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

    if (result?.success) {
      try {
        await agentBookingService.upsertAgentBooking({
          agentId: tenant.agentId || tenant.id,
          tenantId: tenant.id || tenant.agentId,
          locationId: tenant.locationId || tenant.squareLocationId || null,
          merchantId: tenant.squareMerchantId || tenant.merchantId || null,
          booking: {
            id: bookingId,
            startAt: startAt || result?.data?.startAt || result?.data?.start_at || null,
            status: result?.data?.status || null
          }
        });
      } catch (recordError) {
        logger.warn('Failed to update agent booking ledger after update', {
          correlationId,
          bookingId,
          message: recordError.message
        });
      }
    }

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

/**
 * Handle list bookings request (Azure Functions format)
 * Extracted from manageBooking handler
 */
async function handleListBookings(req, correlationId, listBookings) {
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
 * Main booking management router
 * Routes requests to appropriate handler based on action
 * Supports both explicit action parameters and implicit HTTP method-based routing
 */
async function manageBooking(req, res, {
  createBookingCore,
  updateBookingCore,
  listBookings,
  ensureAgentCanModifyBooking
}) {
  const { correlationId, tenant } = req;

  // Get action from params or determine from method
  const action = req.params.action || req.body?.action || getActionFromMethod(req.method);

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

    // Route to appropriate handler based on action
    switch (action) {
      case 'create':
        result = await handleCreateBooking(req, correlationId, createBookingCore);
        break;
      case 'update':
        result = await handleUpdateBooking(req, correlationId, updateBookingCore, ensureAgentCanModifyBooking);
        break;
      case 'cancel':
      case 'delete':
        result = await handleCancelBooking(req, correlationId, ensureAgentCanModifyBooking);
        break;
      case 'get':
        result = await handleGetBooking(req, correlationId);
        break;
      case 'list':
        result = await handleListBookings(req, correlationId, listBookings);
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
              result = await handleCancelBooking(req, correlationId, ensureAgentCanModifyBooking);
              break;
            case 'update':
              result = await handleUpdateBooking(req, correlationId, updateBookingCore, ensureAgentCanModifyBooking);
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

module.exports = {
  manageBooking,
  getActionFromMethod,
  handleCancelBooking,
  handleGetBooking,
  handleCreateBooking,
  handleUpdateBooking,
  handleListBookings
};
