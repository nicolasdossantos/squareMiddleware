/**
 * Admin Routes
 * Tenant onboarding and management endpoints
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middlewares/adminAuth');

// Serve onboarding UI
router.get('/', adminAuth, (req, res) => {
  res.sendFile('index.html', { root: './admin/public' });
});

// API endpoints
router.get('/api/tenants', adminAuth, adminController.listTenants);
router.post('/api/test-credentials', adminAuth, adminController.testCredentials);
router.post('/api/onboard', adminAuth, adminController.onboardTenant);
router.delete('/api/tenants/:agentId', adminAuth, adminController.removeTenant);

module.exports = router;
