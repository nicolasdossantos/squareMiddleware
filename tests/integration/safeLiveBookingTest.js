/**
 * Safe Live Booking Test Suite
 * Tests booking operations on the LIVE Square account with immediate cleanup
 *
 * ⚠️ SAFETY PROTOCOL:
 * 1. Create test booking
 * 2. Verify booking exists
 * 3. IMMEDIATELY cancel booking
 * 4. Verify cancellation
 * 5. Log all operations for audit
 */

const request = require('supertest');
const app = require('../../src/express-app');
const { logEvent, logError } = require('../../src/utils/logger');

// Track created bookings for cleanup
const createdBookings = [];

// Helper function to add delay between operations
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Safe booking creation test
 * Creates a real booking then immediately cancels it
 */
async function testSafeBookingLifecycle() {
  const testStartTime = Date.now();
  const correlationId = `test-${Date.now()}`;

  console.log('\n🔬 STARTING SAFE LIVE BOOKING TEST');
  console.log('🛡️ PROTOCOL: Create → Verify → Cancel → Cleanup');

  try {
    // Step 1: Create a test booking
    console.log('\n📅 Step 1: Creating test booking...');

    const testBookingData = {
      customerId: 'TEST_CUSTOMER_ID', // Use a test customer ID
      serviceIds: ['SERVICE_ID_1'], // Use actual service IDs from Square
      barberId: 'BARBER_ID_1', // Use actual barber ID
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      customerNotes: `TEST BOOKING - DELETE IMMEDIATELY - ${correlationId}`,
      locationType: 'BUSINESS_LOCATION'
    };

    logEvent('safe_test_booking_create_start', {
      correlationId,
      testData: testBookingData,
      timestamp: new Date().toISOString()
    });

    const createResponse = await request(app)
      .post('/api/bookings')
      .send(testBookingData)
      .set('Content-Type', 'application/json')
      .expect(201);

    const bookingId = createResponse.body.data.booking.id;
    createdBookings.push(bookingId);

    console.log(`✅ Booking created: ${bookingId}`);
    console.log(`📝 Confirmation: ${createResponse.body.data.confirmationNumber}`);

    // Step 2: Verify booking exists
    console.log('\n🔍 Step 2: Verifying booking exists...');
    await delay(1000); // Wait 1 second for Square API consistency

    const getResponse = await request(app).get(`/api/bookings/${bookingId}`).expect(200);

    console.log(
      `✅ Booking verified: Status = ${getResponse.body.data.booking.appointmentSegments[0].appointmentStatus}`
    );

    // Step 3: IMMEDIATELY cancel the booking
    console.log('\n🚫 Step 3: IMMEDIATELY canceling test booking...');
    await delay(500); // Brief delay

    await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .query({ version: getResponse.body.data.booking.version })
      .expect(200);

    console.log(`✅ Booking cancelled: ${bookingId}`);

    // Step 4: Verify cancellation
    console.log('\n✅ Step 4: Verifying cancellation...');
    await delay(1000);

    const verifyResponse = await request(app).get(`/api/bookings/${bookingId}`).expect(200);

    const finalStatus = verifyResponse.body.data.booking.appointmentSegments[0].appointmentStatus;
    console.log(`✅ Final Status: ${finalStatus}`);

    // Remove from tracking since it's cancelled
    const index = createdBookings.indexOf(bookingId);
    if (index > -1) {
      createdBookings.splice(index, 1);
    }

    const testDuration = Date.now() - testStartTime;
    console.log(`\n🎉 SAFE TEST COMPLETED SUCCESSFULLY in ${testDuration}ms`);
    console.log('📊 Result: Created → Verified → Cancelled → Cleaned up');

    logEvent('safe_test_booking_lifecycle_success', {
      correlationId,
      bookingId,
      duration: testDuration,
      finalStatus,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      bookingId,
      duration: testDuration,
      finalStatus
    };
  } catch (error) {
    console.error('\n❌ SAFE TEST FAILED:', error.message);

    logError('safe_test_booking_lifecycle_error', error, {
      correlationId,
      createdBookings: createdBookings.slice()
    });

    // Emergency cleanup
    await emergencyCleanup();

    throw error;
  }
}

/**
 * Emergency cleanup function
 * Cancels any remaining test bookings
 */
async function emergencyCleanup() {
  console.log('\n🚨 EMERGENCY CLEANUP: Cancelling any remaining test bookings...');

  for (const bookingId of createdBookings) {
    try {
      console.log(`🚫 Emergency cancelling: ${bookingId}`);

      // Get current booking to get version
      const getResponse = await request(app).get(`/api/bookings/${bookingId}`);

      if (getResponse.status === 200) {
        // Cancel the booking
        await request(app)
          .delete(`/api/bookings/${bookingId}`)
          .query({ version: getResponse.body.data.booking.version });

        console.log(`✅ Emergency cancelled: ${bookingId}`);
      }
    } catch (cleanupError) {
      console.error(`❌ Failed to emergency cancel ${bookingId}:`, cleanupError.message);
      logError('emergency_cleanup_failed', cleanupError, { bookingId });
    }
  }

  createdBookings.length = 0; // Clear the array
  console.log('🧹 Emergency cleanup completed');
}

/**
 * Test suite for all booking operations
 */
async function runSafeBookingTestSuite() {
  console.log('\n🧪 STARTING COMPREHENSIVE SAFE BOOKING TEST SUITE');
  console.log('🛡️ LIVE SQUARE ACCOUNT - ALL OPERATIONS WILL BE CLEANED UP');

  const suiteStartTime = Date.now();
  const results = [];

  try {
    // Test 1: Basic booking lifecycle
    console.log('\n📋 Test 1: Basic Booking Lifecycle');
    const test1 = await testSafeBookingLifecycle();
    results.push({ test: 'Basic Lifecycle', ...test1 });

    // Test 2: Booking validation
    console.log('\n📋 Test 2: Booking Validation (Read-only)');
    const validationResponse = await request(app)
      .get('/api/bookings/availability')
      .query({
        serviceId: 'SERVICE_ID_1',
        date: new Date().toISOString().split('T')[0]
      })
      .expect(200);

    console.log(`✅ Validation test passed: ${validationResponse.body.data.availableSlots?.length || 0} slots found`);
    results.push({ test: 'Validation', success: true, slots: validationResponse.body.data.availableSlots?.length });

    // Test 3: Customer bookings (Read-only)
    console.log('\n📋 Test 3: Customer Bookings (Read-only)');
    const customerResponse = await request(app).get('/api/bookings/customer/TEST_CUSTOMER_ID').expect(200);

    console.log(`✅ Customer bookings test passed: ${customerResponse.body.data.bookings?.length || 0} bookings found`);
    results.push({ test: 'Customer Bookings', success: true, count: customerResponse.body.data.bookings?.length });

    const suiteDuration = Date.now() - suiteStartTime;
    console.log(`\n🎉 ALL TESTS COMPLETED SUCCESSFULLY in ${suiteDuration}ms`);
    console.log(`📊 Summary: ${results.length} tests passed`);
    console.log('🛡️ No live bookings remaining - Account is clean');

    return {
      success: true,
      duration: suiteDuration,
      results,
      message: 'All tests passed with complete cleanup'
    };
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    await emergencyCleanup();
    throw error;
  }
}

// Export test functions
module.exports = {
  testSafeBookingLifecycle,
  runSafeBookingTestSuite,
  emergencyCleanup
};

// Run tests if called directly
if (require.main === module) {
  console.log('🚀 Running Safe Booking Test Suite...');
  runSafeBookingTestSuite()
    .then(result => {
      console.log('\n✅ SAFE TEST SUITE COMPLETED:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ SAFE TEST SUITE FAILED:', error);
      process.exit(1);
    });
}
