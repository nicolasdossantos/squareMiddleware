/**
 * Retell AI Webhook Controller
 * Routes incoming Retell events to dedicated handlers.
 */

const { sendError } = require('../utils/responseBuilder');
const { logPerformance, logEvent } = require('../utils/logger');
const { redactWebhookPayload } = require('../utils/logRedactor');
const {
  handleCallStarted,
  handleCallAnalyzed,
  handleCallEnded,
  handleCallInbound
} = require('./retell/eventHandlers');

const EVENT_HANDLERS = {
  call_started: handleCallStarted,
  call_analyzed: handleCallAnalyzed,
  call_ended: handleCallEnded,
  call_inbound: handleCallInbound,
  inbound: handleCallStarted
};

const EVENT_REQUIREMENTS = {
  call_started: 'call',
  call_analyzed: 'call',
  call_ended: 'call',
  call_inbound: 'call_inbound',
  inbound: 'call'
};

function validateWebhookPayload(payload) {
  if (!payload) {
    return {
      status: 400,
      message: 'Request body is required',
      details: 'No request body received'
    };
  }

  if (typeof payload !== 'object') {
    return {
      status: 400,
      message: 'Invalid request body format',
      details: `Expected JSON object, got ${typeof payload}`
    };
  }

  if (Array.isArray(payload)) {
    return {
      status: 400,
      message: 'Invalid request body format',
      details: 'Expected JSON object, got array'
    };
  }

  if (!payload.event) {
    return {
      status: 400,
      message: 'Missing required field: event',
      details: {
        received_fields: Object.keys(payload),
        event_value: payload.event
      }
    };
  }

  const requiredKey = EVENT_REQUIREMENTS[payload.event];
  if (requiredKey && !payload[requiredKey]) {
    const details =
      requiredKey === 'call_inbound'
        ? {
            received_fields: Object.keys(payload || {}),
            expected: 'call_inbound object with from_number, to_number, agent_id'
          }
        : {
            received_fields: Object.keys(payload || {}),
            [`${requiredKey}_value`]: payload[requiredKey]
          };

    return {
      status: 400,
      message: `Missing required field: ${requiredKey}`,
      details
    };
  }

  return null;
}

function extractCallId(payload) {
  return (
    payload?.call?.call_id || payload?.call_inbound?.call_id || payload?.call_inbound?.agent_id || 'unknown'
  );
}

async function handleRetellWebhook(req, res) {
  const startTime = Date.now();
  const { correlationId, tenant } = req;
  const webhookData = req.body;

  logEvent(
    'retell_webhook_received',
    {
      method: req.method,
      url: req.url,
      bodyType: typeof req.body,
      hasHeaders: !!req.headers['x-retell-signature'],
      event: webhookData?.event,
      bodyKeys: Object.keys(webhookData || {})
    },
    correlationId
  );

  const validationError = validateWebhookPayload(webhookData);
  if (validationError) {
    return sendError(
      res,
      validationError.message,
      validationError.status || 400,
      validationError.details,
      correlationId
    );
  }

  const handler = EVENT_HANDLERS[webhookData.event];
  if (!handler) {
    logEvent('retell_webhook_unhandled', {
      correlationId,
      event: webhookData.event,
      callId: webhookData?.call?.call_id || 'unknown'
    });
    return sendError(res, `Unsupported event type: ${webhookData.event}`, 400, null, correlationId);
  }

  try {
    if (webhookData.event === 'call_analyzed') {
      // Log with redacted payload to protect sensitive call data
      const redactedPayload = redactWebhookPayload(webhookData);
      logEvent('retell_call_analyzed_payload', {
        correlationId,
        payload: redactedPayload
      });
    }

    const context = { correlationId, tenant };
    const result = await handler(webhookData, context);
    const callId = result.callId || extractCallId(webhookData);

    logPerformance(correlationId, 'retell_webhook', startTime, {
      event: webhookData.event,
      callId,
      processed: result.processed,
      ...(result.metrics || {})
    });

    logEvent('retell_webhook_processed', {
      correlationId,
      event: webhookData.event,
      callId,
      result: result.summary
    });

    if (result.response) {
      const { status, body } = result.response;
      if (body === undefined) {
        return res.status(status).send();
      }
      return res.status(status).json(body);
    }

    return res.status(204).send();
  } catch (error) {
    logPerformance(correlationId, 'retell_webhook_error', startTime, {
      event: webhookData?.event,
      errorMessage: error.message || 'Unknown error',
      errorType: error.name || 'Error'
    });

    const errorDetails = error.message || error.toString();
    return sendError(res, 'Failed to process Retell webhook', 500, errorDetails, correlationId);
  }
}

module.exports = {
  handleRetellWebhook,
  handleCallStarted,
  handleCallAnalyzed,
  handleCallEnded,
  handleCallInbound
};
