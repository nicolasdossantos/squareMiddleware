/**
 * Booking Availability Service
 *
 * Handles all service availability queries, including:
 * - Parameter parsing and validation
 * - Availability lookups
 * - Response formatting
 */

const { logger } = require('../utils/logger');
const { logEvent, logPerformance } = require('../utils/logger');
const { sendError } = require('../utils/responseBuilder');
const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
const availabilityHelpers = require('../utils/helpers/availabilityHelpers');

/**
 * Helper to parse potentially JSON values
 */
function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * BigInt replacer for JSON stringification
 */
function bigIntReplacer(key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

/**
 * Extract service variation IDs from request
 */
function extractServiceIds(req) {
  const rawServiceIds =
    req.query.serviceVariationIds ??
    req.query.serviceIds ??
    req.body?.serviceVariationIds ??
    req.body?.serviceIds ??
    req.body?.service_variation_ids ??
    req.retellPayload?.serviceVariationIds ??
    req.retellPayload?.service_variation_ids;

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

  return serviceIdArray;
}

/**
 * Extract staff member ID from request
 */
function extractStaffId(req) {
  const rawStaffId =
    req.query.staffMemberId ??
    req.query.staffId ??
    req.body?.staffMemberId ??
    req.body?.staffId ??
    req.body?.staff_member_id ??
    req.retellPayload?.staffMemberId ??
    req.retellPayload?.staffId ??
    req.retellPayload?.staff_member_id;

  if (rawStaffId) {
    const parsedStaff = typeof rawStaffId === 'string' ? parseMaybeJson(rawStaffId) : rawStaffId;
    return Array.isArray(parsedStaff) ? String(parsedStaff[0]).trim() : String(parsedStaff).trim();
  }

  return null;
}

/**
 * Extract and validate days ahead parameter
 */
function extractDaysAhead(req) {
  const rawDaysAhead =
    req.query.daysAhead ??
    req.body?.daysAhead ??
    req.body?.days_ahead ??
    req.retellPayload?.daysAhead ??
    req.retellPayload?.days_ahead ??
    14;

  const parsedDaysAhead =
    rawDaysAhead !== undefined && rawDaysAhead !== null ? parseInt(rawDaysAhead, 10) : null;

  return parsedDaysAhead !== null && !Number.isNaN(parsedDaysAhead) ? parsedDaysAhead : 14;
}

/**
 * Extract optional target date from request (earliest date to show availability)
 * Used when customer asks for "next week" or specific future date
 * @param {Object} req - Express request object
 * @returns {Date|null} Target date or null if not provided
 */
function extractTargetDate(req) {
  const targetDateString =
    req.query.targetDate ?? req.body?.targetDate ?? req.retellPayload?.targetDate ?? null;

  if (!targetDateString) {
    return null;
  }

  try {
    const parsedDate = new Date(targetDateString);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }
    return parsedDate;
  } catch (error) {
    return null;
  }
}

/**
 * Get service availability for specified services and date range
 *
 * @param {Object} req - Express request with extracted parameters
 * @param {Object} tenant - Tenant context with credentials
 * @param {string} correlationId - Correlation ID for logging
 * @returns {Promise<Object>} Availability response
 */
async function getServiceAvailability(req, tenant, correlationId) {
  const startTime = Date.now();

  try {
    // Extract and validate parameters
    const serviceIdArray = extractServiceIds(req);

    if (!serviceIdArray.length) {
      return {
        status: 400,
        error: 'serviceVariationIds parameter is required',
        data: {
          success: false,
          message: 'serviceVariationIds parameter is required',
          timestamp: new Date().toISOString()
        }
      };
    }

    const staffMemberId = extractStaffId(req);
    const daysAhead = extractDaysAhead(req);
    const targetDate = extractTargetDate(req);

    logger.info(
      `Getting service availability - Services: ${serviceIdArray.join(',')}, ` +
        `Staff: ${staffMemberId}, Days: ${daysAhead}, Target Date: ${targetDate ? targetDate.toISOString() : 'none'}`
    );

    // Validate daysAhead
    if (daysAhead < 1 || daysAhead > 90) {
      return {
        status: 400,
        error: 'Invalid daysAhead',
        data: {
          success: false,
          message: 'daysAhead parameter must be between 1 and 90 (defaults to 14 if not provided)',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Calculate date range
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + daysAhead);

    // Debug logging
    logger.info('🔍 [AVAILABILITY DEBUG] serviceIdArray:', serviceIdArray);
    logger.info(
      '🔍 [AVAILABILITY DEBUG] serviceIdArray lengths:',
      serviceIdArray.map(id => ({ id, length: id.length }))
    );

    // Validate service ID lengths
    for (const serviceId of serviceIdArray) {
      if (serviceId.length > 36) {
        logger.info('🔍 [AVAILABILITY DEBUG] Service ID too long:', {
          serviceId,
          length: serviceId.length,
          first50chars: serviceId.substring(0, 50)
        });

        return {
          status: 400,
          error: 'Service ID too long',
          data: {
            success: false,
            message: `Service variation ID is too long: ${serviceId.length} characters (max 36)`,
            details: `Service ID: ${serviceId.substring(0, 50)}...`,
            timestamp: new Date().toISOString()
          }
        };
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

    // Create a context object similar to Azure Functions
    const context = {
      log: (...args) => logger.info(...args)
    };

    // Load availability from Square API
    const availabilityRecord = await availabilityHelpers.loadAvailability(
      tenant,
      serviceIdArray,
      staffMemberId,
      startDate.toISOString(),
      endDate.toISOString(),
      context
    );

    // Clean BigInt values
    const cleanAvailabilityRecord = cleanBigIntFromObject(availabilityRecord);

    // Filter slots by target date if provided
    let filteredSlots = cleanAvailabilityRecord.slots || [];
    if (targetDate) {
      const targetTime = targetDate.getTime();
      const originalCount = filteredSlots.length;

      filteredSlots = filteredSlots.filter(slot => {
        const slotTime = new Date(slot.startAt).getTime();
        return slotTime >= targetTime;
      });

      logger.info(
        `🔍 [TARGET DATE FILTER] Filtered slots from ${originalCount} to ${filteredSlots.length} ` +
          `(showing only slots >= ${targetDate.toISOString()})`
      );
    }

    const response = {
      id: cleanAvailabilityRecord.id,
      serviceVariationIds: cleanAvailabilityRecord.serviceVariationIds,
      staffMemberId: cleanAvailabilityRecord.staffMemberId,
      slots: filteredSlots,
      timestamp: new Date().toISOString()
    };

    // Log performance
    const logData = cleanBigIntFromObject({
      serviceCount: serviceIdArray.length,
      slotsFound: response.slots?.length || 0
    });

    logPerformance(correlationId, 'service_availability', startTime, logData);

    // Create final response
    const cleanResponse = cleanBigIntFromObject(response);
    const responseData = {
      success: true,
      message: cleanResponse,
      data: 'Service availability retrieved successfully',
      timestamp: new Date().toISOString()
    };

    return {
      status: 200,
      data: responseData,
      jsonString: JSON.stringify(responseData, bigIntReplacer)
    };
  } catch (error) {
    logger.error('Error in getServiceAvailability:', error);

    logPerformance(correlationId, 'service_availability_error', startTime, {
      error: error.message
    });

    return {
      status: 500,
      error: error.message,
      data: {
        success: false,
        message: 'Internal server error',
        error: error.message,
        correlationId
      }
    };
  }
}

module.exports = {
  getServiceAvailability,
  extractServiceIds,
  extractStaffId,
  extractDaysAhead,
  extractTargetDate
};
