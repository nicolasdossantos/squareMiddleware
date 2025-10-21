/**
 * Azure Function: SMS Sender
 *
 * Asynchronous SMS/WhatsApp sending via HTTP trigger
 * Offloads message delivery from main API for better performance
 *
 * Uses Twilio for delivery
 * Free tier: 1M executions/month
 */

const twilio = require('twilio');

// Create reusable Twilio client
let twilioClient = null;

function ensureTwilioConfig() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be configured');
  }
}

function getTwilioClient() {
  if (!twilioClient) {
    ensureTwilioConfig();
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

module.exports = async function (context, req) {
  const correlationId =
    req.headers?.['x-correlation-id'] ||
    req.headers?.['x-correlationid'] ||
    req.headers?.['x_correlation_id'] ||
    null;

  context.log('SMS sender function triggered', {
    correlationId
  });

  try {
    ensureTwilioConfig();

    // Validate request body
    const { to, body, from, type = 'sms', tenant } = req.body || {};

    if (!to || typeof to !== 'string') {
      context.res = {
        status: 400,
        body: {
          error: 'Missing required field: to'
        }
      };
      context.log.warn('SMS request missing recipient', {
        correlationId,
        tenant
      });
      return;
    }

    if (!body || typeof body !== 'string') {
      context.res = {
        status: 400,
        body: {
          error: 'Missing required field: body'
        }
      };
      context.log.warn('SMS request missing message body', {
        correlationId,
        to,
        tenant
      });
      return;
    }

    // Validate phone number format (basic)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const normalizedTo = to.replace(/\s/g, '');
    const isWhatsappFormat = normalizedTo.toLowerCase().startsWith('whatsapp:');
    const e164Candidate = isWhatsappFormat ? normalizedTo.replace(/^whatsapp:/i, '') : normalizedTo;
    if (!phoneRegex.test(e164Candidate)) {
      context.res = {
        status: 400,
        body: {
          error: 'Invalid phone number format. Must be E.164 format (e.g., +12025551234)'
        }
      };
      context.log.warn('SMS request failed phone validation', {
        correlationId,
        to,
        tenant
      });
      return;
    }

    // Determine sender based on type
    let fromNumber = from;
    let recipient = isWhatsappFormat ? normalizedTo : e164Candidate;

    if (type === 'whatsapp') {
      fromNumber = from || process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
      // Ensure 'whatsapp:' prefix
      if (!fromNumber.startsWith('whatsapp:')) {
        fromNumber = `whatsapp:${fromNumber}`;
      }
      // Ensure recipient has whatsapp prefix
      if (!recipient.startsWith('whatsapp:')) {
        recipient = `whatsapp:${recipient}`;
      }
    } else {
      fromNumber = from || process.env.TWILIO_SMS_FROM;
      if (recipient.startsWith('whatsapp:')) {
        recipient = recipient.replace(/^whatsapp:/i, '');
      }
    }

    if (!fromNumber) {
      throw new Error(`No ${type} sender number configured`);
    }

    // Send message
    const client = getTwilioClient();

    const startTime = Date.now();
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: recipient
    });
    const duration = Date.now() - startTime;

    context.log(`${type.toUpperCase()} sent successfully`, {
      messageSid: message.sid,
      to: recipient,
      type,
      tenant,
      duration,
      correlationId
    });

    context.res = {
      status: 200,
      body: {
        success: true,
        messageSid: message.sid,
        status: message.status,
        duration,
        timestamp: new Date().toISOString(),
        correlationId
      }
    };
  } catch (error) {
    context.log.error('Message sending failed', {
      message: error.message,
      stack: error.stack,
      correlationId
    });

    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        correlationId
      }
    };
  }
};
