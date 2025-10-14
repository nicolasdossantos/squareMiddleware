/**
 * SMS Routes
 * Handles SMS messaging endpoints (replacing WhatsApp)
 */

const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');
const { validateSchema, validateContentType } = require('../middlewares/validation');

// SMS validation functions
const validateSendMessage = body => {
  const errors = [];

  if (!body.to || typeof body.to !== 'string') {
    errors.push('Field "to" is required and must be a string');
  } else if (!/^\+[1-9]\d{9,14}$/.test(body.to)) {
    errors.push('Field "to" must be a valid phone number in format +1234567890');
  }

  if (!body.message || typeof body.message !== 'string') {
    errors.push('Field "message" is required and must be a string');
  } else if (body.message.length === 0) {
    errors.push('Field "message" cannot be empty');
  } else if (body.message.length > 1600) {
    errors.push('Field "message" cannot exceed 1600 characters');
  }

  return errors;
};

const validateBookingConfirmation = body => {
  const errors = [];

  if (!body.bookingId || typeof body.bookingId !== 'string') {
    errors.push('Field "bookingId" is required and must be a string');
  }

  if (!body.customerPhone || typeof body.customerPhone !== 'string') {
    errors.push('Field "customerPhone" is required and must be a string');
  } else if (!/^\+[1-9]\d{9,14}$/.test(body.customerPhone)) {
    errors.push('Field "customerPhone" must be a valid phone number in format +1234567890');
  }

  return errors;
};

const validateCustomerMessage = body => {
  const errors = [];

  if (!body.customerFirstName || typeof body.customerFirstName !== 'string') {
    errors.push('Field "customerFirstName" is required and must be a string');
  } else if (body.customerFirstName.trim().length === 0) {
    errors.push('Field "customerFirstName" cannot be empty');
  }

  if (!body.customerLastName || typeof body.customerLastName !== 'string') {
    errors.push('Field "customerLastName" is required and must be a string');
  } else if (body.customerLastName.trim().length === 0) {
    errors.push('Field "customerLastName" cannot be empty');
  }

  if (!body.customerPhoneNumber || typeof body.customerPhoneNumber !== 'string') {
    errors.push('Field "customerPhoneNumber" is required and must be a string');
  } else if (!/^\+[1-9]\d{9,14}$/.test(body.customerPhoneNumber)) {
    errors.push('Field "customerPhoneNumber" must be a valid phone number in format +1234567890');
  }

  if (!body.message || typeof body.message !== 'string') {
    errors.push('Field "message" is required and must be a string');
  } else if (body.message.trim().length === 0) {
    errors.push('Field "message" cannot be empty');
  } else if (body.message.length > 1600) {
    errors.push('Field "message" cannot exceed 1600 characters');
  }

  // Optional messageTo field validation
  if (body.messageTo) {
    if (typeof body.messageTo !== 'string') {
      errors.push('Field "messageTo" must be a string');
    } else if (!/^\+[1-9]\d{9,14}$/.test(body.messageTo)) {
      errors.push('Field "messageTo" must be a valid phone number in format +1234567890');
    }
  }

  return errors;
};

/**
 * POST /api/sms/send
 * Send a simple SMS text message
 */
router.post(
  '/send',
  validateContentType(['application/json']),
  validateSchema(validateSendMessage),
  smsController.sendMessage
);

/**
 * POST /api/sms/booking-confirmation
 * Send booking confirmation SMS message
 */
router.post(
  '/booking-confirmation',
  validateContentType(['application/json']),
  validateSchema(validateBookingConfirmation),
  smsController.sendBookingConfirmation
);

/**
 * POST /api/sms/customer-message
 * Send customer message to barbershop (used by AI agent for escalation)
 */
router.post(
  '/customer-message',
  validateContentType(['application/json']),
  validateSchema(validateCustomerMessage),
  smsController.sendCustomerMessage
);

module.exports = router;
