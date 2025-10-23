/**
 * SMS Controller
 * Handles SMS messaging endpoints (replacing WhatsApp with regular text messages)
 */

const smsService = require('../services/smsService');
const { logEvent, logError } = require('../utils/logger');
const { formatPhoneNumber } = require('../utils/squareUtils');
const { generateCorrelationId } = require('../utils/security');

/**
 * Send a simple SMS text message
 * POST /api/sms/send
 */
async function sendMessage(req, res) {
  const correlationId = req.correlationId || generateCorrelationId();

  try {
    const { to, message } = req.body;

    // Validate required fields
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, message',
        message: 'Both "to" and "message" fields are required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate phone number format
    if (!smsService.validatePhoneNumber(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format',
        message: 'Phone number must be in format +1234567890',
        timestamp: new Date().toISOString()
      });
    }

    logEvent('sms_send_request', {
      to,
      messageLength: message.length,
      correlationId
    });

    const result = await smsService.sendTextMessage(to, message, correlationId);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: {
          messageSid: result.messageSid,
          status: result.status,
          to: result.to,
          from: result.from
        },
        message: 'SMS message sent successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
        message: 'Failed to send SMS message',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logError(error, {
      operation: 'sendSMSMessage',
      correlationId
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while sending SMS message',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Send booking confirmation SMS message
 * POST /api/sms/booking-confirmation
 */
async function sendBookingConfirmation(req, res) {
  const correlationId = req.correlationId || generateCorrelationId();

  try {
    const { bookingId, customerPhone } = req.body;

    // Validate required fields
    if (!bookingId || !customerPhone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bookingId, customerPhone',
        message: 'Both "bookingId" and "customerPhone" fields are required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate phone number format
    if (!smsService.validatePhoneNumber(customerPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format',
        message: 'Phone number must be in format +1234567890',
        timestamp: new Date().toISOString()
      });
    }

    logEvent('sms_booking_confirmation_request', {
      bookingId,
      customerPhone,
      correlationId
    });

    // Mock booking data (you would fetch this from your database)
    const bookingData = {
      bookingId,
      date: 'December 1st, 2024',
      time: '3:00 PM',
      service: 'Haircut & Beard Trim'
    };

    const result = await smsService.sendBookingConfirmation(bookingData, customerPhone, correlationId);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: {
          messageSid: result.messageSid,
          status: result.status,
          to: result.to,
          from: result.from,
          bookingId
        },
        message: 'Booking confirmation SMS sent successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
        message: 'Failed to send booking confirmation SMS',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logError(error, {
      operation: 'sendBookingConfirmationSMS',
      correlationId
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while sending booking confirmation SMS',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Send customer message to barbershop
 * Handles customer messages that need to be relayed to the barbershop
 * Always sends to +12677210098 and optionally to messageTo
 */
async function sendCustomerMessage(req, res) {
  const correlationId = generateCorrelationId();

  try {
    const { customerFirstName, customerLastName, message, messageTo } = req.body;
    const customerPhoneNumber = formatPhoneNumber(req.body.customerPhoneNumber)?.formatted || req.body.customerPhoneNumber;

    logEvent('customer_message_to_barbershop_request', {
      customerFirstName,
      customerLastName,
      customerPhoneNumber,
      messageTo: messageTo || 'none',
      messageLength: message?.length,
      correlationId
    });

    const result = await smsService.sendCustomerMessageToBarbershop(
      customerFirstName,
      customerLastName,
      customerPhoneNumber,
      message,
      messageTo, // Optional second recipient
      correlationId
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: {
          results: result.results,
          recipientCount: result.recipientCount,
          primaryRecipient: result.primaryRecipient,
          secondaryRecipient: result.secondaryRecipient,
          customerName: result.customerName,
          customerPhone: result.customerPhone,
          from: result.from
        },
        message: `Customer message sent to ${result.recipientCount} recipient(s) successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
        message: 'Failed to send customer message to barbershop',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logError(error, {
      operation: 'sendCustomerMessageToBarbershop',
      correlationId
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while sending customer message',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  sendMessage,
  sendBookingConfirmation,
  sendCustomerMessage
};
