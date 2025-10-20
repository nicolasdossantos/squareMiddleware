/**
 * Retell AI Webhook Service
 * Business logic for processing Retell AI webhook events
 */

const { logPerformance, logEvent, logError } = require('../utils/logger');
const customerService = require('./customerService');
const retellEmailService = require('./retellEmailService');

/**
 * Process call analysis from Retell AI (similar to PostCallWebhook)
 */
async function processCallAnalysis({
  callId,
  fromNumber,
  transcript,
  analysis,
  correlationId,
  tenant,
  callData
}) {
  const startTime = Date.now();

  try {
    logEvent('retell_process_call_analysis_start', {
      correlationId,
      callId,
      hasTranscript: !!transcript,
      hasAnalysis: !!analysis,
      hasTenant: !!tenant,
      hasCallData: !!callData
    });

    // Get customer information using tenant context
    let customerInfo = null;
    if (tenant && fromNumber) {
      try {
        customerInfo = await customerService.getCustomerInfo(tenant, fromNumber);
      } catch (customerError) {
        logEvent('retell_customer_lookup_failed', {
          correlationId,
          callId,
          fromNumber: fromNumber ? `${fromNumber.substring(0, 5)}***` : 'unknown',
          error: customerError.message
        });
      }
    }

    // Send post-call email using retellEmailService
    let emailResult = null;
    if (callData) {
      try {
        const emailTo = process.env.EMAIL_TO || tenant?.staffEmail;
        console.log(`📧 [RETELL EMAIL] Sending post-call email to ${emailTo}`);

        await retellEmailService.sendRetellPostCallEmail(callData, correlationId);

        emailResult = {
          type: 'email_sent',
          target: emailTo,
          success: true
        };

        logEvent('retell_email_sent', {
          correlationId,
          callId,
          recipient: emailTo
        });
      } catch (emailError) {
        console.error('❌ [RETELL EMAIL] Failed to send email:', emailError);

        logError(emailError, {
          operation: 'sendRetellPostCallEmail',
          callId,
          correlationId
        });

        emailResult = {
          type: 'email_failed',
          target: process.env.EMAIL_TO || tenant?.staffEmail,
          error: emailError.message
        };
      }
    } else {
      console.warn('⚠️ [RETELL EMAIL] Skipping email - missing callData');
    }

    // Log performance
    logPerformance('retell_process_call_analysis', startTime);

    return {
      customerInfo,
      emailResult,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    logError(error, {
      operation: 'processCallAnalysis',
      callId,
      correlationId
    });

    throw {
      message: error.message || 'Failed to process call analysis',
      code: error.code || 'ANALYSIS_ERROR',
      status: error.status || error.statusCode || 500
    };
  }
}

module.exports = {
  processCallAnalysis
};
