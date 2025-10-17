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
    if (tenant && tenant.staffEmail && callData) {
      try {
        console.log(`📧 [RETELL EMAIL] Sending post-call email to ${tenant.staffEmail}`);

        await retellEmailService.sendRetellPostCallEmail(
          callData,
          tenant.staffEmail,
          tenant.businessName
        );

        emailResult = {
          type: 'email_sent',
          target: tenant.staffEmail,
          success: true
        };

        logEvent('retell_email_sent', {
          correlationId,
          callId,
          recipient: tenant.staffEmail
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
          target: tenant.staffEmail,
          error: emailError.message
        };
      }
    } else {
      console.warn(
        `⚠️ [RETELL EMAIL] Skipping email - missing tenant: ${!!tenant}, ` +
          `staffEmail: ${tenant?.staffEmail}, callData: ${!!callData}`
      );
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

    throw error;
  }
}

module.exports = {
  processCallAnalysis
};
