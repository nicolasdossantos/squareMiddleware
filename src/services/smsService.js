/**
 * SMS Service
 * Handles SMS messaging through Twilio API (regular text messages, not WhatsApp)
 */

const twilio = require('twilio');
const { logPerformance, logEvent, logError } = require('../utils/logger');
const { config } = require('../config');

/**
 * Initialize Twilio client
 */
function getTwilioClient() {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    throw new Error('Twilio credentials not configured');
  }

  return twilio(config.twilio.accountSid, config.twilio.authToken);
}

/**
 * Send a simple SMS text message
 * @param {string} to - Phone number in format '+1234567890'
 * @param {string} message - Text message to send
 * @param {string} correlationId - Optional correlation ID for tracking
 * @returns {Promise<Object>} Message response from Twilio
 */
async function sendTextMessage(to, message, correlationId = null) {
  const startTime = Date.now();

  try {
    const client = getTwilioClient();

    // Format phone number (remove any whatsapp: prefix if present)
    const formattedTo = to.replace(/^whatsapp:/, '');

    const messageData = {
      to: formattedTo,
      from: config.twilio.smsFrom, // Use SMS from number instead of WhatsApp
      body: message
    };

    logEvent('sms_message_sending', {
      to: formattedTo,
      correlationId,
      messageLength: message.length
    });

    const response = await client.messages.create(messageData);

    logEvent('sms_message_sent', {
      messageSid: response.sid,
      to: formattedTo,
      status: response.status,
      correlationId
    });

    logPerformance(correlationId, 'sendSMSTextMessage', startTime, {
      messageSid: response.sid,
      status: response.status
    });

    return {
      success: true,
      messageSid: response.sid,
      status: response.status,
      to: formattedTo,
      from: config.twilio.smsFrom
    };
  } catch (error) {
    logError(error, {
      operation: 'sendSMSTextMessage',
      to,
      correlationId
    });

    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Send customer message to barbershop via SMS
 * Always sends to +12677210098 and optionally to a second number
 * @param {string} customerFirstName - Customer's first name
 * @param {string} customerLastName - Customer's last name
 * @param {string} customerPhoneNumber - Customer's phone number
 * @param {string} message - Message from customer
 * @param {string} messageTo - Optional second phone number to send to
 * @param {string} correlationId - Optional correlation ID for tracking
 * @returns {Promise<Object>} Message response from Twilio
 */
async function sendCustomerMessageToBarbershop(
  customerFirstName,
  customerLastName,
  customerPhoneNumber,
  message,
  messageTo = null,
  correlationId = null
) {
  const startTime = Date.now();

  try {
    const client = getTwilioClient();

    // Format the message for SMS (no templates needed)
    const formattedMessage = `🔔 Customer Message Alert

👤 Customer: ${customerFirstName} ${customerLastName}
📞 Phone: ${customerPhoneNumber}

💬 Message:
${message}

---
Sent via Booking API`;

    // Always send to the main barbershop number
    const primaryNumber = '+12677210098';
    const results = [];

    // Send to primary number
    const primaryMessageData = {
      to: primaryNumber,
      from: config.twilio.smsFrom,
      body: formattedMessage
    };

    logEvent('customer_message_to_barbershop_sending', {
      customerName: `${customerFirstName} ${customerLastName}`,
      customerPhone: customerPhoneNumber,
      primaryRecipient: primaryNumber,
      secondaryRecipient: messageTo || 'none',
      correlationId,
      messageLength: message.length
    });

    const primaryResponse = await client.messages.create(primaryMessageData);
    results.push({
      recipient: primaryNumber,
      messageSid: primaryResponse.sid,
      status: primaryResponse.status
    });

    logEvent('customer_message_sent', {
      messageSid: primaryResponse.sid,
      recipient: primaryNumber,
      status: primaryResponse.status,
      correlationId
    });

    // Send to secondary number if provided
    if (messageTo && validatePhoneNumber(messageTo)) {
      const secondaryMessageData = {
        to: messageTo,
        from: config.twilio.smsFrom,
        body: formattedMessage
      };

      const secondaryResponse = await client.messages.create(secondaryMessageData);
      results.push({
        recipient: messageTo,
        messageSid: secondaryResponse.sid,
        status: secondaryResponse.status
      });

      logEvent('customer_message_sent', {
        messageSid: secondaryResponse.sid,
        recipient: messageTo,
        status: secondaryResponse.status,
        correlationId
      });
    }

    logEvent('customer_message_to_barbershop_sent', {
      customerName: `${customerFirstName} ${customerLastName}`,
      customerPhone: customerPhoneNumber,
      recipientCount: results.length,
      primaryRecipient: primaryNumber,
      secondaryRecipient: messageTo || 'none',
      correlationId
    });

    logPerformance(correlationId, 'sendCustomerMessageToBarbershop', startTime, {
      recipientCount: results.length,
      primarySid: results[0]?.messageSid,
      secondarySid: results[1]?.messageSid
    });

    return {
      success: true,
      results: results,
      recipientCount: results.length,
      primaryRecipient: primaryNumber,
      secondaryRecipient: messageTo || null,
      customerName: `${customerFirstName} ${customerLastName}`,
      customerPhone: customerPhoneNumber,
      from: config.twilio.smsFrom
    };
  } catch (error) {
    logError(error, {
      operation: 'sendCustomerMessageToBarbershop',
      customerName: `${customerFirstName} ${customerLastName}`,
      customerPhone: customerPhoneNumber,
      primaryRecipient: '+12677210098',
      secondaryRecipient: messageTo || 'none',
      correlationId
    });

    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Send booking confirmation SMS message
 * @param {Object} bookingData - Booking details
 * @param {string} customerPhone - Customer's phone number
 * @param {string} correlationId - Optional correlation ID for tracking
 * @returns {Promise<Object>} Message response
 */
async function sendBookingConfirmation(bookingData, customerPhone, correlationId = null) {
  const startTime = Date.now();

  try {
    // Format booking confirmation message
    const confirmationMessage = `✅ Booking Confirmed!

📅 Date: ${bookingData.date || 'TBD'}
🕐 Time: ${bookingData.time || 'TBD'}
💇 Service: ${bookingData.service || 'Haircut'}

See you soon!
- Your Service Team`;

    const result = await sendTextMessage(customerPhone, confirmationMessage, correlationId);

    logEvent('booking_confirmation_sent', {
      bookingId: bookingData.bookingId,
      customerPhone,
      status: result.status,
      correlationId
    });

    logPerformance(correlationId, 'sendBookingConfirmation', startTime, {
      messageSid: result.messageSid,
      status: result.status
    });

    return result;
  } catch (error) {
    logError(error, {
      operation: 'sendBookingConfirmation',
      bookingId: bookingData.bookingId,
      customerPhone,
      correlationId
    });

    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Validate phone number format for SMS
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
function validatePhoneNumber(phoneNumber) {
  // Remove any whatsapp: prefix and validate E.164 format
  const cleanNumber = phoneNumber.replace(/^whatsapp:/, '');
  return /^\+[1-9]\d{9,14}$/.test(cleanNumber);
}

/**
 * Format phone number for SMS
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phoneNumber) {
  // Remove whatsapp: prefix if present
  return phoneNumber.replace(/^whatsapp:/, '');
}

module.exports = {
  sendTextMessage,
  sendCustomerMessageToBarbershop,
  sendBookingConfirmation,
  validatePhoneNumber,
  formatPhoneNumber
};
