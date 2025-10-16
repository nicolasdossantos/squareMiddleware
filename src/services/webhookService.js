/**
 * Webhook Service
 * Business logic for webhook processing and external integrations
 */

const crypto = require('crypto');
const { logPerformance, logEvent, logError, logSecurityEvent } = require('../utils/logger');
const { config } = require('../config');
const emailService = require('./emailService');

/**
 * Verify ElevenLabs webhook signature
 */
async function verifyElevenLabsSignature(payload, signature) {
  try {
    if (!config.elevenlabs.webhookSecret) {
      logSecurityEvent('elevenlabs_webhook_secret_missing');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.elevenlabs.webhookSecret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

    if (!isValid) {
      logSecurityEvent('elevenlabs_webhook_signature_invalid', {
        providedSignature: `${providedSignature.substring(0, 10)}...`,
        expectedSignature: `${expectedSignature.substring(0, 10)}...`
      });
    }

    return isValid;
  } catch (error) {
    logError(error, {
      operation: 'verifyElevenLabsSignature'
    });
    return false;
  }
}

/**
 * Verify Square webhook signature
 */
async function verifySquareSignature(body, signature, hmacSignature) {
  try {
    if (!config.square.webhookSecret) {
      logSecurityEvent('square_webhook_secret_missing');
      return false;
    }

    // Square uses both URL + body for signature
    const url = config.square.webhookUrl || '';
    const stringToSign = url + JSON.stringify(body);

    const expectedSignature = crypto
      .createHmac('sha256', config.square.webhookSecret)
      .update(stringToSign)
      .digest('base64');

    const signatureToCompare = hmacSignature || signature;
    const isValid = crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signatureToCompare));

    if (!isValid) {
      logSecurityEvent('square_webhook_signature_invalid', {
        providedSignature: `${signatureToCompare.substring(0, 10)}...`,
        expectedSignature: `${expectedSignature.substring(0, 10)}...`
      });
    }

    return isValid;
  } catch (error) {
    logError(error, {
      operation: 'verifySquareSignature'
    });
    return false;
  }
}

/**
 * Process ElevenLabs post-call webhook
 */
async function processElevenLabsPostCall(webhookData) {
  const startTime = Date.now();

  try {
    logEvent('elevenlabs_webhook_process_start', {
      conversationId: webhookData.conversation_id,
      callDuration: webhookData.call_length_secs
    });

    const {
      conversation_id,
      call_length_secs,
      call_successful,
      transcript,
      analysis,
      customer_phone_number
    } = webhookData;

    // Extract booking information from transcript/analysis
    const bookingInfo = extractBookingInfo(transcript, analysis);

    // Process actions based on call analysis
    const actions = [];

    if (bookingInfo.hasBookingIntent) {
      logEvent('booking_intent_detected', {
        conversationId: conversation_id,
        customerPhone: `${customer_phone_number?.substring(0, 5)}***`,
        serviceRequested: bookingInfo.serviceRequested
      });

      // Send booking confirmation email if customer provided email
      if (bookingInfo.customerEmail) {
        try {
          await emailService.sendBookingConfirmation({
            customerEmail: bookingInfo.customerEmail,
            customerName: bookingInfo.customerName,
            serviceRequested: bookingInfo.serviceRequested,
            preferredDate: bookingInfo.preferredDate,
            preferredTime: bookingInfo.preferredTime,
            conversationId: conversation_id
          });

          actions.push({
            type: 'email_sent',
            target: bookingInfo.customerEmail,
            success: true
          });
        } catch (emailError) {
          logError(emailError, {
            operation: 'sendBookingConfirmation',
            conversationId: conversation_id
          });

          actions.push({
            type: 'email_failed',
            target: bookingInfo.customerEmail,
            error: emailError.message
          });
        }
      }

      // Send follow-up SMS if phone number provided
      if (customer_phone_number && bookingInfo.needsFollowUp) {
        actions.push({
          type: 'sms_scheduled',
          target: customer_phone_number,
          message: "Thank you for calling! We'll follow up within 24 hours to confirm your appointment."
        });
      }
    }

    // Log call analytics
    if (analysis) {
      logEvent('call_analysis_processed', {
        conversationId: conversation_id,
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        satisfaction: analysis.customer_satisfaction,
        bookingDetected: bookingInfo.hasBookingIntent
      });
    }

    // Send summary notification to staff
    if (call_successful && (bookingInfo.hasBookingIntent || analysis?.priority === 'high')) {
      try {
        await emailService.sendStaffNotification({
          conversationId: conversation_id,
          customerPhone: customer_phone_number,
          callDuration: call_length_secs,
          summary: analysis?.summary || 'Customer inquiry received',
          bookingInfo,
          priority: analysis?.priority || 'normal'
        });

        actions.push({
          type: 'staff_notification_sent',
          success: true
        });
      } catch (notificationError) {
        logError(notificationError, {
          operation: 'sendStaffNotification',
          conversationId: conversation_id
        });
      }
    }

    const result = {
      processed: true,
      conversationId: conversation_id,
      callDuration: call_length_secs,
      successful: call_successful,
      bookingDetected: bookingInfo.hasBookingIntent,
      actions,
      summary: `Processed call ${conversation_id} (${call_length_secs}s) with ${actions.length} actions`
    };

    logPerformance(null, 'elevenlabs_webhook_process', startTime, {
      conversationId: conversation_id,
      actionsCount: actions.length,
      bookingDetected: bookingInfo.hasBookingIntent
    });

    logEvent('elevenlabs_webhook_process_success', {
      conversationId: conversation_id,
      actionsCompleted: actions.length,
      bookingDetected: bookingInfo.hasBookingIntent
    });

    return result;
  } catch (error) {
    logError(error, {
      operation: 'processElevenLabsPostCall',
      conversationId: webhookData.conversation_id,
      duration: Date.now() - startTime
    });
    throw new Error(`Failed to process ElevenLabs webhook: ${error.message}`);
  }
}

/**
 * Process Square payment webhook
 */
async function processSquarePayment(webhookData) {
  const startTime = Date.now();

  try {
    logEvent('square_payment_webhook_process_start', {
      eventType: webhookData.type,
      merchantId: webhookData.merchant_id
    });

    const { type, data, event_id } = webhookData;
    const paymentData = data?.object?.payment || {};

    const result = {
      processed: true,
      eventId: event_id,
      eventType: type,
      paymentId: paymentData.id,
      actions: []
    };

    switch (type) {
      case 'payment.created': {
        logEvent('payment_created', {
          paymentId: paymentData.id,
          amount: paymentData.amount_money?.amount,
          currency: paymentData.amount_money?.currency
        });

        const amount = paymentData.amount_money?.amount;
        const currency = paymentData.amount_money?.currency;
        result.summary = `Payment ${paymentData.id} created for ${amount} ${currency}`;
        break;
      }

      case 'payment.updated':
        logEvent('payment_updated', {
          paymentId: paymentData.id,
          status: paymentData.status
        });

        if (paymentData.status === 'COMPLETED') {
          // Send payment confirmation
          result.actions.push({
            type: 'payment_confirmation',
            paymentId: paymentData.id,
            scheduled: true
          });
        }

        result.summary = `Payment ${paymentData.id} updated to ${paymentData.status}`;
        break;

      default:
        logEvent('square_payment_webhook_unhandled', {
          eventType: type,
          paymentId: paymentData.id
        });

        result.summary = `Unhandled payment event: ${type}`;
    }

    logPerformance(null, 'square_payment_webhook_process', startTime, {
      eventType: type,
      paymentId: paymentData.id
    });

    return result;
  } catch (error) {
    logError(error, {
      operation: 'processSquarePayment',
      eventType: webhookData.type,
      duration: Date.now() - startTime
    });
    throw new Error(`Failed to process Square payment webhook: ${error.message}`);
  }
}

/**
 * Process Square booking webhook
 */
async function processSquareBooking(webhookData) {
  const startTime = Date.now();

  try {
    logEvent('square_booking_webhook_process_start', {
      eventType: webhookData.type,
      merchantId: webhookData.merchant_id
    });

    const { type, data, event_id } = webhookData;
    const bookingData = data?.object?.booking || {};

    const result = {
      processed: true,
      eventId: event_id,
      eventType: type,
      bookingId: bookingData.id,
      actions: []
    };

    switch (type) {
      case 'booking.created':
        logEvent('booking_created', {
          bookingId: bookingData.id,
          customerId: bookingData.customer_id,
          status: bookingData.status
        });

        result.summary = `Booking ${bookingData.id} created for customer ${bookingData.customer_id}`;
        break;

      case 'booking.updated':
        logEvent('booking_updated', {
          bookingId: bookingData.id,
          customerId: bookingData.customer_id,
          status: bookingData.status
        });

        if (bookingData.status === 'CONFIRMED') {
          // Send booking confirmation
          result.actions.push({
            type: 'booking_confirmation',
            bookingId: bookingData.id,
            scheduled: true
          });
        }

        result.summary = `Booking ${bookingData.id} updated to ${bookingData.status}`;
        break;

      default:
        logEvent('square_booking_webhook_unhandled', {
          eventType: type,
          bookingId: bookingData.id
        });

        result.summary = `Unhandled booking event: ${type}`;
    }

    logPerformance(null, 'square_booking_webhook_process', startTime, {
      eventType: type,
      bookingId: bookingData.id
    });

    return result;
  } catch (error) {
    logError(error, {
      operation: 'processSquareBooking',
      eventType: webhookData.type,
      duration: Date.now() - startTime
    });
    throw new Error(`Failed to process Square booking webhook: ${error.message}`);
  }
}

/**
 * Extract booking information from call transcript and analysis
 */
function extractBookingInfo(transcript, analysis) {
  const bookingInfo = {
    hasBookingIntent: false,
    serviceRequested: null,
    customerName: null,
    customerEmail: null,
    preferredDate: null,
    preferredTime: null,
    needsFollowUp: false
  };

  try {
    // Check for booking keywords in transcript
    if (transcript) {
      const bookingKeywords = [
        'appointment',
        'booking',
        'schedule',
        'haircut',
        'trim',
        'color',
        'highlights',
        'style',
        'book',
        'available'
      ];

      const lowerTranscript = transcript.toLowerCase();
      bookingInfo.hasBookingIntent = bookingKeywords.some(keyword => lowerTranscript.includes(keyword));

      // Extract service mentions
      const services = ['haircut', 'color', 'highlights', 'trim', 'style', 'wash'];
      for (const service of services) {
        if (lowerTranscript.includes(service)) {
          bookingInfo.serviceRequested = service;
          break;
        }
      }

      // Extract email pattern
      const emailMatch = transcript.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        bookingInfo.customerEmail = emailMatch[0];
      }

      // Extract name patterns (basic)
      const nameMatch = transcript.match(/my name is ([a-zA-Z\s]+)/i);
      if (nameMatch) {
        bookingInfo.customerName = nameMatch[1].trim();
      }
    }

    // Use analysis data if available
    if (analysis) {
      if (analysis.intent === 'booking' || analysis.intent === 'appointment') {
        bookingInfo.hasBookingIntent = true;
      }

      if (analysis.extracted_info) {
        bookingInfo.serviceRequested = analysis.extracted_info.service || bookingInfo.serviceRequested;
        bookingInfo.customerName = analysis.extracted_info.name || bookingInfo.customerName;
        bookingInfo.customerEmail = analysis.extracted_info.email || bookingInfo.customerEmail;
        bookingInfo.preferredDate = analysis.extracted_info.date;
        bookingInfo.preferredTime = analysis.extracted_info.time;
      }

      // Determine if follow-up needed
      bookingInfo.needsFollowUp =
        analysis.needs_follow_up || (bookingInfo.hasBookingIntent && !bookingInfo.preferredDate);
    }
  } catch (error) {
    logError(error, {
      operation: 'extractBookingInfo'
    });
  }

  return bookingInfo;
}

module.exports = {
  verifyElevenLabsSignature,
  verifySquareSignature,
  processElevenLabsPostCall,
  processSquarePayment,
  processSquareBooking
};
