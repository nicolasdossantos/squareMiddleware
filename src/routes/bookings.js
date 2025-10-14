/**
 * Booking Routes
 * RESTful routes for comprehensive booking management
 * Migrated from Azure Function BookingManager to Express.js
 */

const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const { validateSchema, validateContentType } = require('../middlewares/validation');
const bookingController = require('../controllers/bookingController');
const correlationId = require('../middlewares/correlationId');
const { validateBookingData } = require('../utils/helpers/bookingHelpers');

const router = express.Router();

// Apply correlation ID middleware to all booking routes
router.use(correlationId);

// Wrapper for validateBookingData to match middleware expectations
const validateCustomerBooking = body => {
  const result = validateBookingData(body);
  return result.isValid ? [] : result.errors;
};

/**
 * GET /api/bookings/availability
 * Get service availability for a specific date
 */
router.get('/availability', asyncHandler(bookingController.getServiceAvailability));

/**
 * POST /api/bookings
 * Create a new booking with availability validation
 */
router.post(
  '/',
  validateContentType(['application/json']),
  validateSchema(validateCustomerBooking),
  asyncHandler(bookingController.createBooking)
);

/**
 * GET /api/bookings/:bookingId
 * Get booking details by ID
 */
router.get('/:bookingId', asyncHandler(bookingController.getBooking));

/**
 * PUT /api/bookings/:bookingId
 * Update existing booking with availability validation
 */
router.put(
  '/:bookingId',
  validateContentType(['application/json']),
  validateSchema(validateCustomerBooking),
  asyncHandler(bookingController.updateBooking)
);

/**
 * DELETE /api/bookings/:bookingId
 * Cancel/delete a booking
 */
router.delete('/:bookingId', asyncHandler(bookingController.cancelBooking));

/**
 * GET /api/bookings/customer/:customerId
 * Get all bookings for a specific customer
 */
router.get('/customer/:customerId', asyncHandler(bookingController.getCustomerBookings));

/**
 * GET /api/bookings/customer/:customerId/active
 * Get active (upcoming) bookings for a specific customer
 */
router.get('/customer/:customerId/active', asyncHandler(bookingController.getCustomerActiveBookings));

/**
 * GET /api/bookings
 * List bookings with filters (admin/staff endpoint)
 */
router.get('/', asyncHandler(bookingController.listBookings));

/**
 * DELETE /api/bookings/:bookingId
 * Cancel booking
 */
router.delete('/:bookingId', asyncHandler(bookingController.cancelBooking));

/**
 * POST /api/bookings/:bookingId/confirm
 * Confirm booking
 */
router.post('/:bookingId/confirm', asyncHandler(bookingController.confirmBooking));

module.exports = router;
