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

// Main API routes (replacement for Azure Functions)
router.use('/', apiRoutes);

module.exports = router;

// Admin routes are mounted separately in express-app.js
module.exports.adminRoutes = adminRoutes;
