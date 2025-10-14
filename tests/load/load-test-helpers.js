// Artillery helper functions for load testing
'use strict';

module.exports = {
  generateTestCustomerId,
  generateTestServiceId,
  generateFutureDate,
  generateValidBookingData,
  validateResponse,
  setContext
};

/**
 * Generate a random test customer ID
 */
function generateTestCustomerId(context, events, done) {
  context.vars.testCustomerId = `test-customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return done();
}

/**
 * Generate a random service ID
 */
function generateTestServiceId(context, events, done) {
  const services = ['haircut', 'shampoo', 'styling', 'coloring', 'beard-trim'];
  context.vars.serviceId = services[Math.floor(Math.random() * services.length)];
  return done();
}

/**
 * Generate a future date for appointments
 */
function generateFutureDate(context, events, done) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0); // 10:00 AM
  context.vars.futureDate = tomorrow.toISOString();
  return done();
}

/**
 * Generate valid booking data
 */
function generateValidBookingData(context, events, done) {
  const bookingData = {
    customerId: `test-customer-${Date.now()}`,
    serviceId: 'haircut',
    appointmentTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    duration: 60,
    notes: 'Load test booking'
  };

  context.vars.bookingData = bookingData;
  return done();
}

/**
 * Validate API response structure
 */
function validateResponse(req, res, context, events, done) {
  if (res.statusCode >= 200 && res.statusCode < 300) {
    try {
      const body = JSON.parse(res.body);

      // Health endpoint validation
      if (req.url.includes('/health')) {
        if (!body.status) {
          events.emit('error', 'Health response missing status field');
        }
      }

      // Service availability validation
      if (req.url.includes('/service-availability')) {
        if (res.statusCode === 200 && !body.availableSlots) {
          events.emit('error', 'Service availability response missing availableSlots');
        }
      }

      // Booking response validation
      if (req.url.includes('/bookings') && req.method === 'POST') {
        if (res.statusCode === 201 && !body.bookingId) {
          events.emit('error', 'Booking response missing bookingId');
        }
      }
    } catch (e) {
      if (res.statusCode < 400) {
        events.emit('error', `Invalid JSON response: ${e.message}`);
      }
    }
  }

  return done();
}

/**
 * Set up test context
 */
function setContext(context, events, done) {
  // Set common test data
  context.vars.testPrefix = 'load-test';
  context.vars.timestamp = Date.now();

  // Set realistic test parameters
  context.vars.validServiceIds = ['haircut', 'shampoo', 'styling'];
  context.vars.validDurations = [30, 45, 60, 90];

  return done();
}
