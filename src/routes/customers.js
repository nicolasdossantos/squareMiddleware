/**
 * Customer Routes
 * Routes for customer information and booking management
 */

const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const { validateSchema, validateContentType } = require('../middlewares/validation');
const { validateCustomerInfo } = require('../utils/inputValidation');
const customerController = require('../controllers/customerController');
const agentAuth = require('../middlewares/agentAuth');

const router = express.Router();

// Apply agent authentication to all customer routes
router.use(agentAuth);

/**
 * COMPATIBILITY ROUTES FOR AZURE FUNCTIONS MIGRATION
 * These routes maintain compatibility with the old function-based API
 * NOTE: These must come BEFORE parameterized routes to avoid conflicts
 */

/**
 * POST /api/customers/info
 * Get customer information by phone (Azure Functions compatibility)
 */
router.post(
  '/info',
  validateContentType(['application/json']),
  asyncHandler(customerController.getCustomerInfoByPhone)
);

/**
 * PUT /api/customers/update
 * Update customer information (Azure Functions compatibility)
 */
router.put(
  '/update',
  validateContentType(['application/json']),
  asyncHandler(customerController.updateCustomerInfoCompatibility)
);

/**
 * PUT /api/customers/:customerId
 * Update customer information
 */
router.put(
  '/:customerId',
  validateContentType(['application/json']),
  validateSchema(validateCustomerInfo),
  asyncHandler(customerController.updateCustomerInfo)
);

/**
 * POST /api/customers/:customerId/bookings
 * Create new booking for customer
 */
router.post(
  '/:customerId/bookings',
  validateContentType(['application/json']),
  asyncHandler(customerController.createBooking)
);

/**
 * DELETE /api/customers/:customerId/bookings/:bookingId
 * Cancel customer booking
 */
router.delete('/:customerId/bookings/:bookingId', asyncHandler(customerController.cancelBooking));

module.exports = router;
