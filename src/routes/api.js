/**
 * Main API Routes
 * Direct replacement for Azure Functions API endpoints
 * Hot reloading enabled for development
 */

const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const correlationId = require('../middlewares/correlationId');
const customerController = require('../controllers/customerController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// Apply correlation ID middleware to all API routes
router.use(correlationId);

/**
 * GET/POST /api/customer/info
 * Get customer information by phone or customer_id
 * Replaces Azure Functions GetCustomerInfo endpoint
 */
router.get('/customer/info', asyncHandler(customerController.getCustomerInfo));
router.post('/customer/info', asyncHandler(customerController.getCustomerInfoByPhone));
router.put('/customer/info', asyncHandler(customerController.updateCustomerInfo));

/**
 * POST /api/customers/bookings
 * Get customer bookings by customer_id or phone
 * Replaces Azure Functions GetCustomerBookings endpoint
 */
router.post('/customers/bookings', asyncHandler(customerController.getCustomerBookings));

/**
 * GET /api/availability
 * Get service availability using daysAhead parameter
 * Replaces Azure Functions GetServiceAvailability endpoint
 */
router.get('/availability', asyncHandler(bookingController.getServiceAvailability));

/**
 * ALL /api/booking/:action and /api/booking
 * Main booking management endpoint
 * Replaces Azure Functions BookingManager endpoint
 */
router.all('/booking/:action', asyncHandler(bookingController.manageBooking));
router.all('/booking', asyncHandler(bookingController.manageBooking));

module.exports = router;
