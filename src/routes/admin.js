/**
 * Admin Routes
 * Tenant onboarding and management endpoints
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middlewares/adminAuth');

const ADMIN_PUBLIC_DIR = path.join(__dirname, '../../admin/public');

// Serve static admin assets (requires auth)
router.use('/', adminAuth, express.static(ADMIN_PUBLIC_DIR));

// Serve onboarding UI
router.get('/', adminAuth, (req, res, next) => {
  res.sendFile(path.join(ADMIN_PUBLIC_DIR, 'index.html'), err => {
    if (err) {
      next(err);
    }
  });
});

// API endpoints
router.get('/api/tenants', adminAuth, adminController.listTenants);
router.post('/api/test-credentials', adminAuth, adminController.testCredentials);
router.post('/api/onboard', adminAuth, adminController.onboardTenant);
router.delete('/api/tenants/:agentId', adminAuth, adminController.removeTenant);

module.exports = router;
