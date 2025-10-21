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

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

module.exports = async function (context, req) {
  context.log('SMS sender function triggered');

  try {
    // Validate request body
    const { to, body, from, type = 'sms', tenant } = req.body;

    if (!to || !body) {
      context.res = {
        status: 400,
        body: {
          error: 'Missing required fields: to and body'
        }
      };
      return;
    }

    // Validate phone number format (basic)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to.replace(/\s/g, ''))) {
      context.res = {
        status: 400,
        body: {
          error: 'Invalid phone number format. Must be E.164 format (e.g., +12025551234)'
        }
      };
      return;
    }

    // Determine sender based on type
    let fromNumber;
    if (type === 'whatsapp') {
      fromNumber = from || process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
      // Ensure 'whatsapp:' prefix
      if (!fromNumber.startsWith('whatsapp:')) {
        fromNumber = `whatsapp:${fromNumber}`;
      }
      // Ensure recipient has whatsapp prefix
      if (!to.startsWith('whatsapp:')) {
        to = `whatsapp:${to}`;
      }
    } else {
      fromNumber = from || process.env.TWILIO_SMS_FROM;
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
      to
    });
    const duration = Date.now() - startTime;

    context.log(`${type.toUpperCase()} sent successfully`, {
      messageSid: message.sid,
      to,
      type,
      tenant,
      duration
    });

    context.res = {
      status: 200,
      body: {
        success: true,
        messageSid: message.sid,
        status: message.status,
        duration,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    context.log.error('Message sending failed:', error.message);

    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
};
