/**
 * SMS Service
 * Handles SMS messaging (regular text messages, not WhatsApp)
 */

const { logPerformance, logEvent, logError } = require('../utils/logger');
const { config } = require('../config');
const smsTransport = require('./smsTransport');

const PRIMARY_BARBERSHOP_NUMBER = '+12677210098';

/**
 * Send a simple SMS text message
 * @param {string} to - Phone number in format '+1234567890'
 * @param {string} message - Text message to send
 * @param {string} correlationId - Optional correlation ID for tracking
 * @returns {Promise<Object>} Message response with delivery metadata
 */
async function sendTextMessage(to, message, correlationId = null) {
  const startTime = Date.now();
  const formattedTo = formatPhoneNumber(to);

  try {
    logEvent('sms_message_sending', {
      to: formattedTo,
      correlationId,
      messageLength: message.length
    });

    const result = await smsTransport.sendSms({
      to: formattedTo,
      body: message,
      from: config.twilio.smsFrom,
      type: 'sms',
      tenant: 'default_sms',
      correlationId
    });

    const status = result.status || 'queued';

    if (result.via !== 'function') {
      logEvent('sms_function_fallback', {
        to: formattedTo,
        correlationId,
        transport: result.via,
        status
      });
    }

    logEvent('sms_message_sent', {
      messageSid: result.messageSid,
      to: formattedTo,
      status,
      correlationId,
      transport: result.via
    });

    logPerformance(correlationId, 'sendSMSTextMessage', startTime, {
      messageSid: result.messageSid,
      status,
      transport: result.via
    });

    return {
      success: true,
      messageSid: result.messageSid,
      status,
      to: formattedTo,
      from: config.twilio.smsFrom,
      transport: result.via
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
 * Always sends to the primary business number and optionally a secondary number
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
    const formattedMessage = `🔔 Customer Message Alert

👤 Customer: ${customerFirstName} ${customerLastName}
📞 Phone: ${customerPhoneNumber}

💬 Message:
${message}

---
Sent via Booking API`;

    const results = [];

    logEvent('customer_message_to_barbershop_sending', {
      customerName: `${customerFirstName} ${customerLastName}`,
      customerPhone: customerPhoneNumber,
      primaryRecipient: PRIMARY_BARBERSHOP_NUMBER,
      secondaryRecipient: messageTo || 'none',
      correlationId,
      messageLength: message.length
    });

    const primaryResult = await smsTransport.sendSms({
      to: PRIMARY_BARBERSHOP_NUMBER,
      body: formattedMessage,
      from: config.twilio.smsFrom,
      type: 'sms',
      tenant: 'customer_message_primary',
      correlationId
    });

    if (primaryResult.via !== 'function') {
      logEvent('sms_function_fallback', {
        recipient: PRIMARY_BARBERSHOP_NUMBER,
        correlationId,
        transport: primaryResult.via,
        status: primaryResult.status || 'queued'
      });
    }

    results.push({
      recipient: PRIMARY_BARBERSHOP_NUMBER,
      messageSid: primaryResult.messageSid,
      status: primaryResult.status || 'queued',
      transport: primaryResult.via
    });

    logEvent('customer_message_sent', {
      messageSid: primaryResult.messageSid,
      recipient: PRIMARY_BARBERSHOP_NUMBER,
      status: primaryResult.status || 'queued',
      correlationId,
      transport: primaryResult.via
    });

    if (messageTo && validatePhoneNumber(messageTo)) {
      const secondaryResult = await smsTransport.sendSms({
        to: formatPhoneNumber(messageTo),
        body: formattedMessage,
        from: config.twilio.smsFrom,
        type: 'sms',
        tenant: 'customer_message_secondary',
        correlationId
      });

      if (secondaryResult.via !== 'function') {
        logEvent('sms_function_fallback', {
          recipient: formatPhoneNumber(messageTo),
          correlationId,
          transport: secondaryResult.via,
          status: secondaryResult.status || 'queued'
        });
      }

      results.push({
        recipient: formatPhoneNumber(messageTo),
        messageSid: secondaryResult.messageSid,
        status: secondaryResult.status || 'queued',
        transport: secondaryResult.via
      });

      logEvent('customer_message_sent', {
        messageSid: secondaryResult.messageSid,
        recipient: formatPhoneNumber(messageTo),
        status: secondaryResult.status || 'queued',
        correlationId,
        transport: secondaryResult.via
      });
    }

    logEvent('customer_message_to_barbershop_sent', {
      customerName: `${customerFirstName} ${customerLastName}`,
      customerPhone: customerPhoneNumber,
      recipientCount: results.length,
      primaryRecipient: PRIMARY_BARBERSHOP_NUMBER,
      secondaryRecipient: messageTo || 'none',
      correlationId
    });

    logPerformance(correlationId, 'sendCustomerMessageToBarbershop', startTime, {
      recipientCount: results.length,
      transports: results.map(result => result.transport)
    });

    return {
      success: true,
      results,
      recipientCount: results.length,
      primaryRecipient: PRIMARY_BARBERSHOP_NUMBER,
      secondaryRecipient: messageTo || null,
      customerName: `${customerFirstName} ${customerLastName}`,
      customerPhone: customerPhoneNumber,
      messageLength: message.length
    };
  } catch (error) {
    logError(error, {
      operation: 'sendCustomerMessageToBarbershop',
      customerName: `${customerFirstName} ${customerLastName}`,
      customerPhone: customerPhoneNumber,
      primaryRecipient: PRIMARY_BARBERSHOP_NUMBER,
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
 */
async function sendBookingConfirmation(bookingData, customerPhone, correlationId = null) {
  const startTime = Date.now();

  try {
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
      correlationId,
      transport: result.transport
    });

    logPerformance(correlationId, 'sendBookingConfirmation', startTime, {
      messageSid: result.messageSid,
      status: result.status,
      transport: result.transport
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

function validatePhoneNumber(phoneNumber) {
  const cleanNumber = phoneNumber.replace(/^whatsapp:/, '');
  return /^\+[1-9]\d{9,14}$/.test(cleanNumber);
}

function formatPhoneNumber(phoneNumber) {
  return phoneNumber.replace(/^whatsapp:/, '');
}

module.exports = {
  sendTextMessage,
  sendCustomerMessageToBarbershop,
  sendBookingConfirmation,
  validatePhoneNumber,
  formatPhoneNumber
};
