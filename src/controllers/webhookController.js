/**
 * Webhook Controller
 * Handles external webhook integrations with comprehensive functionality
 */

const { sendSuccess, sendError } = require('../utils/responseBuilder');
const { logPerformance, logEvent, logSecurityEvent } = require('../utils/logger');
const {
  verifyWebhookSignature,
  processElevenLabsPostCall
} = require('../services/comprehensiveWebhookService');
const webhookService = require('../services/webhookService');
const { config } = require('../config');

/**
 * Handle ElevenLabs post-call webhook with comprehensive functionality
 */
async function handleElevenLabsPostCall(req, res) {
  const startTime = Date.now();
  const { correlationId } = req;
  const webhookData = req.body;

  try {
    logEvent('elevenlabs_webhook_received', {
      correlationId,
      type: webhookData.type,
      hasData: !!webhookData.data,
      conversationId: webhookData.data?.conversation_id
    });

    // Verify webhook signature if available (same as old version)
    const signature = req.headers['elevenlabs-signature'] || req.headers['ElevenLabs-Signature'];
    if (signature && config.elevenlabs.webhookSecret) {
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(webhookData);
      const isValid = verifyWebhookSignature(rawBody, signature, config.elevenlabs.webhookSecret);

      if (!isValid) {
        logSecurityEvent(
          'invalid_webhook_signature',
          {
            source: 'elevenlabs',
            signature: signature ? `${signature.substring(0, 8)}...` : 'none'
          },
          req
        );

        return sendError(res, 'Invalid webhook signature', 401);
      }
    }

    // Process webhook with comprehensive functionality
    const result = await processElevenLabsPostCall(webhookData, correlationId);

    logPerformance(correlationId, 'elevenlabs_webhook', startTime, {
      conversationId: result.conversationId,
      processed: result.processed,
      type: result.type,
      emailSent: result.emailSent,
      toolsProcessed: result.toolsProcessed || 0
    });

    logEvent('elevenlabs_webhook_processed', {
      correlationId,
      conversationId: result.conversationId,
      result: result.summary,
      type: result.type
    });

    sendSuccess(res, result, 'Webhook processed successfully');
  } catch (error) {
    logPerformance(correlationId, 'elevenlabs_webhook_error', startTime, {
      conversationId: webhookData.data?.conversation_id,
      error: error.message
    });

    sendError(res, 'Failed to process webhook', 500, error.message);
  }
}

/**
 * Handle Square payment webhook
 */
async function handleSquarePayment(req, res) {
  const startTime = Date.now();
  const { correlationId } = req;
  const webhookData = req.body;

  try {
    logEvent('square_payment_webhook_received', {
      correlationId,
      eventType: webhookData.type,
      merchantId: webhookData.merchant_id
    });

    // Verify webhook signature
    const signature = req.headers['x-square-signature'];
    if (!signature) {
      logSecurityEvent(
        'missing_webhook_signature',
        {
          source: 'square_payment'
        },
        req
      );

      return sendError(res, 'Missing webhook signature', 401);
    }

    const isValid = await webhookService.verifySquareSignature(
      req.body,
      signature,
      req.headers['x-square-hmacsha256-signature']
    );

    if (!isValid) {
      logSecurityEvent(
        'invalid_webhook_signature',
        {
          source: 'square_payment',
          signature
        },
        req
      );

      return sendError(res, 'Invalid webhook signature', 401);
    }

    const result = await webhookService.processSquarePayment(webhookData);

    logPerformance(correlationId, 'square_payment_webhook', startTime, {
      eventType: webhookData.type,
      processed: result.processed
    });

    logEvent('square_payment_webhook_processed', {
      correlationId,
      eventType: webhookData.type,
      result: result.summary
    });

    sendSuccess(res, result, 'Payment webhook processed successfully');
  } catch (error) {
    logPerformance(correlationId, 'square_payment_webhook_error', startTime, {
      eventType: webhookData.type,
      error: error.message
    });

    sendError(res, 'Failed to process payment webhook', 500, error.message);
  }
}

/**
 * Handle Square booking webhook
 */
async function handleSquareBooking(req, res) {
  const startTime = Date.now();
  const { correlationId } = req;
  const webhookData = req.body;

  try {
    logEvent('square_booking_webhook_received', {
      correlationId,
      eventType: webhookData.type,
      merchantId: webhookData.merchant_id
    });

    // Verify webhook signature
    const signature = req.headers['x-square-signature'];
    if (!signature) {
      logSecurityEvent(
        'missing_webhook_signature',
        {
          source: 'square_booking'
        },
        req
      );

      return sendError(res, 'Missing webhook signature', 401);
    }

    const isValid = await webhookService.verifySquareSignature(
      req.body,
      signature,
      req.headers['x-square-hmacsha256-signature']
    );

    if (!isValid) {
      logSecurityEvent(
        'invalid_webhook_signature',
        {
          source: 'square_booking',
          signature
        },
        req
      );

      return sendError(res, 'Invalid webhook signature', 401);
    }

    const result = await webhookService.processSquareBooking(webhookData);

    logPerformance(correlationId, 'square_booking_webhook', startTime, {
      eventType: webhookData.type,
      processed: result.processed
    });

    logEvent('square_booking_webhook_processed', {
      correlationId,
      eventType: webhookData.type,
      result: result.summary
    });

    sendSuccess(res, result, 'Booking webhook processed successfully');
  } catch (error) {
    logPerformance(correlationId, 'square_booking_webhook_error', startTime, {
      eventType: webhookData.type,
      error: error.message
    });

    sendError(res, 'Failed to process booking webhook', 500, error.message);
  }
}

/**
 * Webhook health check
 */
async function healthCheck(req, res) {
  const { correlationId } = req;

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      webhooks: {
        elevenlabs: 'active',
        square_payment: 'active',
        square_booking: 'active'
      }
    };

    logEvent('webhook_health_check', {
      correlationId,
      status: health.status
    });

    sendSuccess(res, health, 'Webhook service is healthy');
  } catch (error) {
    sendError(res, 'Health check failed', 500, error.message);
  }
}

module.exports = {
  handleElevenLabsPostCall,
  handleSquarePayment,
  handleSquareBooking,
  healthCheck
};
