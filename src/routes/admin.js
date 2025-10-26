/**
 * Admin Routes
 * Protected administrative endpoints
 */

const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const adminAuth = require('../middlewares/adminAuth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// All admin routes require authentication
router.use(adminAuth);

/**
 * POST /api/admin/complete-onboarding
 * Complete agent onboarding after OAuth callback
 *
 * Body:
 * {
 *   "agentId": "agent_new_shop",
 *   "businessName": "Joe's Cuts",
 *   "accessToken": "EAAAl...",
 *   "refreshToken": "rrf_...",
 *   "expiresAt": "2025-11-25T00:00:00Z",
 *   "scope": ["APPOINTMENTS_READ", ...],
 *   "merchantId": "MERCHANT_123",
 *   "defaultLocationId": "L123ABC",
 *   "supportsSellerLevelWrites": false,
 *   "timezone": "America/New_York",
 *   "squareEnvironment": "production",
 *   "staffEmail": "joe@joescuts.com"
 * }
 */
router.post('/complete-onboarding', asyncHandler(adminController.completeOnboarding));

/**
 * GET /api/admin/agents
 * List all configured agents (safe data only, no tokens)
 */
router.get('/agents', asyncHandler(adminController.listAgents));

module.exports = router;
