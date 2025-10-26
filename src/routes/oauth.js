/**
 * OAuth Routes
 * Square OAuth authorization flow endpoints
 */

const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const oauthController = require('../controllers/oauthController');

const router = express.Router();

/**
 * GET /oauth/authorize
 * Generate Square OAuth authorization URL
 *
 * Query params:
 * - agentId: Your internal agent identifier (required)
 * - businessName: Business name (optional)
 * - environment: 'sandbox' or 'production' (default: from env)
 *
 * Returns JSON with authorization URL to redirect user to
 */
router.get('/authorize', asyncHandler(oauthController.generateAuthorizationUrl));

/**
 * GET /authcallback
 * Square OAuth callback endpoint (already implemented)
 * Square redirects here after seller authorizes
 */
router.get('/authcallback', asyncHandler(oauthController.handleAuthCallback));

module.exports = router;
