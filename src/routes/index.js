/**
 * Routes Index
 * Main routing configuration
 */

const express = require('express');
const customerRoutes = require('./customers');
const bookingRoutes = require('./bookings');
const webhookRoutes = require('./webhooks');
const smsRoutes = require('./sms'); // Changed from whatsapp to sms
const healthRoutes = require('./health');
const apiRoutes = require('./api');
const adminRoutes = require('./admin');
const oauthRoutes = require('./oauth');
const authRoutes = require('./auth');
const onboardingRoutes = require('./onboarding');
const analyticsRoutes = require('./analytics');
const phoneNumberRoutes = require('./phoneNumbers');
const customerMemoryRoutes = require('./customerMemory');

const router = express.Router();

// API version info
router.get('/', (req, res) => {
  res.json({
    service: 'Square Middleware API',
    version: '2.0.0',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Mount route modules
router.use('/customers', customerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/sms', smsRoutes); // Changed from whatsapp to sms
router.use('/health', healthRoutes);
router.use('/oauth', oauthRoutes); // OAuth authorization flow
router.use('/admin', adminRoutes); // Admin endpoints (protected)
router.use('/auth', authRoutes); // Tenant authentication
router.use('/onboarding', onboardingRoutes); // Customer onboarding actions
router.use('/analytics', analyticsRoutes); // Dashboard analytics
router.use('/phone-numbers', phoneNumberRoutes); // Phone number management
router.use('/customer-memory', customerMemoryRoutes); // Customer memory management

// Main API routes (replacement for Azure Functions)
router.use('/', apiRoutes);

module.exports = router;
