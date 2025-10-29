/**
 * Customer Controller
 * Handles customer information and booking operations
 */

const { sendSuccess, sendError, sendNotFound } = require('../utils/responseBuilder');
const { logPerformance, logEvent } = require('../utils/logger');
const logger = require('../utils/logger');
const customerService = require('../services/customerService');
const { buildConversationInitiationData } = require('../services/customerInfoResponseService');
const { getRelativeTimeframe } = require('../utils/helpers/dateHelpers');
const { stripRetellMeta } = require('../utils/retellPayload');
const { redactObject } = require('../utils/logRedactor');
const { createError } = require('../utils/errorCodes');

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
    if (error.code) {
      throw error;
    }
    throw createError('CUSTOMER_SEARCH_FAILED', { customerId }, null, 'Failed to get customer');
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
    if (error.code) {
      throw error;
    }
    throw createError('CUSTOMER_SEARCH_FAILED', { phone }, null, 'Failed to get customer by phone');
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
    if (error.code) {
      throw error;
    }
    throw createError('CUSTOMER_CREATION_FAILED', { customerData }, null, 'Failed to create customer');
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
    if (error.code) {
      throw error;
    }
    throw createError(
      'CUSTOMER_UPDATE_FAILED',
      { customerId, updateData },
      null,
      'Failed to update customer'
    );
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
    if (error.code) {
      throw error;
    }
    throw createError('CUSTOMER_SEARCH_FAILED', { filters }, null, 'Failed to list customers');
  }
}

/**
 * Update customer information
 */
async function updateCustomerInfo(req, res) {
  const startTime = Date.now();
  const { tenant, correlationId } = req;

  // 🔍 PARAMETER LOGGING FOR UPDATE CUSTOMER INFO (WITH REDACTION)
  logger.debug('🚀 [UPDATE CUSTOMER] Raw request received:', {
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

  // Log redacted versions of query and params
  const redactedQuery = redactObject(req.query || {});
  const redactedParams = redactObject(req.params || {});
  logger.debug('📋 [UPDATE CUSTOMER] Query parameters:', redactedQuery);
  logger.debug('📋 [UPDATE CUSTOMER] Route parameters:', redactedParams);

  // Log body analysis with redacted body
  const redactedBody = redactObject(req.body || {});
  logger.debug('📋 [UPDATE CUSTOMER] Request body analysis:', {
    bodyKeys: Object.keys(req.body || {}),
    bodySize: JSON.stringify(req.body || {}).length,
    redactedBody: redactedBody
  });

  // Support both Express.js (customerId) and Azure Functions (customer_id) formats
  const customerId =
    req.query.customerId || req.params.customerId || req.body.customerId || req.body.customer_id;

  logger.debug('🔍 [UPDATE CUSTOMER] Customer ID extraction:', {
    queryCustomerId: req.query.customerId,
    paramsCustomerId: req.params.customerId,
    bodyCustomerId: req.body.customerId,
    bodyCustomer_id: req.body.customer_id,
    finalCustomerId: customerId,
    correlationId
  });

  // Remove customer ID from update data to avoid conflicts
  const updateData = stripRetellMeta({ ...(req.body || {}) });
  delete updateData.customerId;
  delete updateData.customer_id;

  logger.debug('📝 [UPDATE CUSTOMER] Update data analysis:', {
    originalBodyKeys: Object.keys(req.body || {}),
    cleanedUpdateDataKeys: Object.keys(updateData),
    updateDataPresent: !!Object.keys(updateData).length,
    correlationId
  });

  if (!customerId) {
    logger.warn('❌ [UPDATE CUSTOMER] Missing customer ID');
    return res.status(400).json({
      success: false,
      message: 'Customer ID is required',
      timestamp: new Date().toISOString()
    });
  }

  logger.debug('👤 [UPDATE CUSTOMER] Starting update process for customer:', customerId);

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
  const { caller_id, phone, phoneNumber } = req.body;
  const { correlationId, tenant } = req;

  const customerPhone = caller_id || phone || phoneNumber;

  try {
    const payload = await buildConversationInitiationData({
      tenant,
      phoneNumber: customerPhone,
      correlationId
    });

    return res.json(payload);
  } catch (error) {
    logger.error('Error in getCustomerInfoByPhone:', error);

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

  logger.info('🔍 COMPATIBILITY FUNCTION CALLED');
  logger.info('req.body:', redactObject(req.body));

  try {
    // Support both Express.js (customerId) and Azure Functions (customer_id) formats
    const customerId = req.body.customerId || req.body.customer_id;
    const updateData = { ...req.body };
    delete updateData.customerId;
    delete updateData.customer_id;

    logger.info('Extracted customerId:', customerId);

    if (!customerId) {
      logger.info('❌ Customer ID is missing in compatibility function!');
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
