const twilio = require('twilio');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { invokeSmsFunction, isSmsFunctionConfigured } = require('../utils/functionInvoker');

let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient) {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      throw new Error('Twilio credentials not configured');
    }

    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }

  return twilioClient;
}

async function sendSms({
  to,
  body,
  from,
  type = 'sms',
  tenant = 'unknown',
  correlationId = null,
  timeoutMs
}) {
  if (!to) {
    throw new Error('SMS recipient number is required');
  }

  const senderNumber = from || config.twilio.smsFrom;
  if (!senderNumber) {
    throw new Error('SMS sender number is not configured');
  }

  const payload = {
    to,
    body,
    from: senderNumber,
    type,
    tenant
  };

  if (isSmsFunctionConfigured()) {
    try {
      const response = await invokeSmsFunction(payload, correlationId, { timeoutMs });
      const responseData = response?.data || {};
      const messageSid = responseData.messageSid || responseData.sid || `function-${Date.now()}`;
      const status = responseData.status || response?.status || 'queued';

      logger.info('SMS delivered via Azure Function', {
        to,
        type,
        correlationId,
        tenant,
        messageSid,
        status: response?.status
      });

      return {
        success: true,
        via: 'function',
        messageSid,
        status
      };
    } catch (error) {
      if (error.isFunctionNotConfigured) {
        logger.info('SMS function not configured; using Twilio fallback', {
          correlationId,
          tenant
        });
      } else {
        logger.warn('SMS function failed, falling back to Twilio', {
          correlationId,
          tenant,
          to,
          error: error.message,
          status: error.status,
          functionName: error.functionName
        });
      }
    }
  }

  const client = getTwilioClient();
  const result = await client.messages.create({
    body,
    from: senderNumber,
    to
  });

  logger.info('SMS delivered via Twilio fallback', {
    to,
    type,
    correlationId,
    tenant,
    messageSid: result.sid,
    status: result.status
  });

  return {
    success: true,
    via: 'twilio',
    messageSid: result.sid,
    status: result.status
  };
}

module.exports = {
  sendSms
};
