/**
 * Retell AI Webhook Service
 * Business logic for processing Retell AI webhook events
 */

const { logPerformance, logEvent, logError } = require('../utils/logger');
const customerService = require('./customerService');
const emailService = require('./emailService');

/**
 * Process call analysis from Retell AI (similar to PostCallWebhook)
 */
async function processCallAnalysis({ callId, fromNumber, transcript, analysis, correlationId }) {
  const startTime = Date.now();

  try {
    logEvent('retell_process_call_analysis_start', {
      correlationId,
      callId,
      hasTranscript: !!transcript,
      hasAnalysis: !!analysis
    });

    // Get customer information
    let customerInfo = null;
    try {
      customerInfo = await customerService.getCustomerInfo(fromNumber);
    } catch (customerError) {
      logEvent('retell_customer_lookup_failed', {
        correlationId,
        callId,
        fromNumber: fromNumber ? `${fromNumber.substring(0, 5)}***` : 'unknown',
        error: customerError.message
      });
    }

    // Extract booking information from transcript and analysis
    const bookingInfo = extractBookingInfo(transcript, analysis);

    // Process actions based on call analysis
    const actions = [];

    // Handle booking intent
    if (bookingInfo.hasBookingIntent) {
      logEvent('retell_booking_intent_detected', {
        correlationId,
        callId,
        customerPhone: fromNumber ? `${fromNumber.substring(0, 5)}***` : 'unknown',
        serviceRequested: bookingInfo.serviceRequested
      });

      // Send booking confirmation email if available
      if (bookingInfo.customerEmail) {
        try {
          await emailService.sendBookingConfirmation({
            customerEmail: bookingInfo.customerEmail,
            customerName: bookingInfo.customerName,
            serviceRequested: bookingInfo.serviceRequested,
            callId: callId,
            fromNumber: fromNumber
          });

          actions.push({
            type: 'email_sent',
            target: bookingInfo.customerEmail,
            success: true
          });
        } catch (emailError) {
          logError(emailError, {
            operation: 'sendBookingConfirmation',
            callId,
            correlationId
          });

          actions.push({
            type: 'email_failed',
            target: bookingInfo.customerEmail,
            error: emailError.message
          });
        }
      }

      // Schedule follow-up if needed
      if (fromNumber && bookingInfo.needsFollowUp) {
        actions.push({
          type: 'followup_scheduled',
          target: fromNumber,
          message: "Thank you for calling! We'll follow up within 24 hours to confirm your appointment."
        });
      }
    }

    // Send staff notification for important calls
    if (bookingInfo.hasBookingIntent || analysis?.priority === 'high' || analysis?.sentiment === 'negative') {
      try {
        await emailService.sendStaffNotification({
          callId: callId,
          customerPhone: fromNumber,
          transcript: transcript,
          analysis: analysis,
          bookingInfo: bookingInfo,
          priority: analysis?.priority || 'normal',
          correlationId
        });

        actions.push({
          type: 'staff_notification_sent',
          success: true
        });
      } catch (notificationError) {
        logError(notificationError, {
          operation: 'sendStaffNotification',
          callId,
          correlationId
        });
      }
    }

    const result = {
      processed: true,
      callId: callId,
      customerFound: !!customerInfo?.customer,
      customerInfo: customerInfo?.customer
        ? {
            id: customerInfo.customer.id,
            name: `${customerInfo.customer.givenName || ''} ${customerInfo.customer.familyName || ''}`.trim()
          }
        : null,
      bookingDetected: bookingInfo.hasBookingIntent,
      actions,
      summary: `Processed call analysis for ${callId} with ${actions.length} actions`
    };

    logPerformance(correlationId, 'retell_process_call_analysis', startTime, {
      callId,
      actionsCount: actions.length,
      bookingDetected: bookingInfo.hasBookingIntent
    });

    logEvent('retell_process_call_analysis_success', {
      correlationId,
      callId,
      actionsCompleted: actions.length,
      bookingDetected: bookingInfo.hasBookingIntent
    });

    return result;
  } catch (error) {
    logError(error, {
      operation: 'processCallAnalysis',
      callId,
      correlationId,
      duration: Date.now() - startTime
    });
    throw new Error(`Failed to process Retell call analysis: ${error.message}`);
  }
}

/**
 * Extract booking information from transcript and analysis
 * (Similar to the ElevenLabs implementation)
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
    // Check transcript for booking keywords
    if (transcript) {
      const bookingKeywords = /\b(appointment|booking|book|schedule|haircut|trim|beard|shave|service)\b/i;
      if (bookingKeywords.test(transcript)) {
        bookingInfo.hasBookingIntent = true;

        // Extract service patterns
        const servicePatterns = {
          haircut: /\b(haircut|hair\s?cut|cut)\b/i,
          beard: /\b(beard|facial\s?hair)\b/i,
          trim: /\b(trim|trimming)\b/i,
          eyebrows: /\b(eyebrow|brow)\b/i
        };

        for (const [service, pattern] of Object.entries(servicePatterns)) {
          if (pattern.test(transcript)) {
            bookingInfo.serviceRequested = service;
            break;
          }
        }

        // Extract email pattern
        const emailMatch = transcript.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          bookingInfo.customerEmail = emailMatch[0];
        }

        // Extract name patterns
        const nameMatch = transcript.match(/my name is ([a-zA-Z\s]+)/i);
        if (nameMatch) {
          bookingInfo.customerName = nameMatch[1].trim();
        }
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
  processCallAnalysis,
  extractBookingInfo
};
