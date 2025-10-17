/**
 * Webhook Routes
 * Routes for external webhook integrations
 */

const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const { validateContentType } = require('../middlewares/validation');
const { retellAuth } = require('../middlewares/retellAuth');
const webhookController = require('../controllers/webhookController');
const retellWebhookController = require('../controllers/retellWebhookController');
const { sendError } = require('../utils/responseBuilder');

const router = express.Router();

/**
 * Method not allowed handler
 */
function methodNotAllowed(req, res) {
  return sendError(res, 'Method not allowed', 405, `Method ${req.method} not allowed for this endpoint`);
}

/**
 * Square booking webhook handler that checks method
 */
function handleSquareBookingRequest(req, res, next) {
  if (req.method === 'POST') {
    validateContentType(['application/json'])(req, res, err => {
      if (err) return next(err);
      return asyncHandler(webhookController.handleSquareBooking)(req, res, next);
    });
  } else {
    return methodNotAllowed(req, res);
  }
}

/**
 * Retell AI webhook handler that checks method
 */
function handleRetellRequest(req, res, next) {
  if (req.method === 'POST') {
    // First validate signature, then content type, then process
    retellAuth(req, res, err => {
      if (err) return next(err);
      validateContentType(['application/json'])(req, res, err => {
        if (err) return next(err);
        return asyncHandler(retellWebhookController.handleRetellWebhook)(req, res, next);
      });
    });
  } else {
    return methodNotAllowed(req, res);
  }
}

/**
 * Square booking webhook
 */
router.all('/square/booking', handleSquareBookingRequest);

/**
 * Retell AI webhook (handles both call_started and call_analyzed events)
 */
router.all('/retell', handleRetellRequest);

/**
 * GET /api/webhooks/health
 * Webhook health check
 */
router.get('/health', asyncHandler(webhookController.healthCheck));

module.exports = router;
