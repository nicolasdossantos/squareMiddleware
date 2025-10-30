const { logger, logEvent } = require('../utils/logger');
const {
  invokeIssueDiagnosticsFunction,
  invokeEmailFunction,
  isIssueDiagnosticsConfigured,
  FunctionError
} = require('../utils/functionInvoker');

/**
 * Enqueue a failed call for diagnostics via the Azure Function.
 */
async function sendAlertEmail({ tenant, ticketResponse, correlationId }) {
  const alertEmail =
    process.env.ISSUE_ALERT_EMAIL_TO ||
    process.env.ALERT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.EMAIL_TO ||
    tenant?.staffEmail;

  if (!alertEmail) {
    logger.warn('issue_diagnostics_notification_email_missing', {
      correlationId,
      tenantId: tenant?.id
    });
    return;
  }

  const severity = ticketResponse?.severity ? String(ticketResponse.severity).toUpperCase() : 'MEDIUM';
  const businessName = tenant?.businessName || 'AI Receptionist';
  const subject = `[${severity}] AI Issue detected for ${businessName}`;

  const summary = ticketResponse?.summary || 'An issue was detected during an AI receptionist call.';
  const recommendation =
    ticketResponse?.recommendation || 'Review the call transcript and take corrective action.';
  const prevention = ticketResponse?.prevention || null;

  let dashboardLink = null;
  if (process.env.DASHBOARD_URL && ticketResponse?.ticketId) {
    const base = process.env.DASHBOARD_URL.replace(/\/$/, '');
    dashboardLink = `${base}/admin/support/tickets/${ticketResponse.ticketId}`;
  }

  const htmlSections = [
    `<p><strong>Severity:</strong> ${severity}</p>`,
    `<p><strong>Summary:</strong> ${summary}</p>`,
    `<p><strong>Recommendation:</strong> ${recommendation}</p>`
  ];

  const textSections = [`Severity: ${severity}`, `Summary: ${summary}`, `Recommendation: ${recommendation}`];

  if (prevention) {
    htmlSections.push(`<p><strong>Prevention:</strong> ${prevention}</p>`);
    textSections.push(`Prevention: ${prevention}`);
  }

  if (dashboardLink) {
    htmlSections.push(`<p><a href="${dashboardLink}">View Ticket</a></p>`);
    textSections.push(`Ticket: ${dashboardLink}`);
  }

  try {
    await invokeEmailFunction(
      {
        to: alertEmail,
        subject,
        html: htmlSections.join('\n'),
        text: textSections.join('\n'),
        tenant: tenant?.id || null
      },
      correlationId,
      {
        timeoutMs: parseInt(process.env.ISSUE_ALERT_EMAIL_TIMEOUT_MS || '7000', 10)
      }
    );

    logEvent('issue_diagnostics_alert_email_sent', {
      correlationId,
      tenantId: tenant?.id || null,
      ticketId: ticketResponse?.ticketId || null,
      severity
    });
  } catch (error) {
    logger.error('issue_diagnostics_alert_email_failed', {
      message: error.message,
      correlationId,
      tenantId: tenant?.id || null
    });
  }
}

async function enqueueIssueDiagnostics({ tenant, call, callHistoryId, analysis, transcript, correlationId }) {
  if (!isIssueDiagnosticsConfigured()) {
    logger.warn('issue_diagnostics_function_not_configured', {
      correlationId
    });
    return null;
  }

  if (!tenant?.id || !call?.call_id) {
    logger.warn('issue_diagnostics_missing_context', {
      hasTenant: Boolean(tenant?.id),
      hasCallId: Boolean(call?.call_id),
      correlationId
    });
    return null;
  }

  const payload = {
    tenantId: tenant.id,
    callId: call.call_id,
    callHistoryId: callHistoryId || null,
    transcript: transcript || null,
    analysis: analysis || {},
    callSummary: call.call_summary || null,
    metadata: {
      agentId: call.agent_id || null,
      direction: call.direction || null,
      startTimestamp: call.start_timestamp || null,
      endTimestamp: call.end_timestamp || null,
      durationMs: call.duration_ms || null,
      languageDetected: analysis?.language_preference || null,
      userSentiment: analysis?.user_sentiment || null,
      llmVariables: call.retell_llm_dynamic_variables || null,
      source: 'retell_webhook'
    },
    tenant: {
      id: tenant.id,
      businessName: tenant.businessName || null
    },
    correlationId
  };

  try {
    const response = await invokeIssueDiagnosticsFunction(payload, correlationId, {
      timeoutMs: parseInt(process.env.ISSUE_DIAGNOSTICS_TIMEOUT_MS || '8000', 10)
    });

    logEvent('issue_diagnostics_enqueued', {
      correlationId,
      tenantId: tenant.id,
      callId: call.call_id,
      response: response?.data || null
    });

    if (response?.data?.success) {
      await sendAlertEmail({
        tenant,
        ticketResponse: response.data,
        correlationId
      });
    }

    return response?.data || null;
  } catch (error) {
    if (error instanceof FunctionError && error.isFunctionNotConfigured) {
      logger.warn('issue_diagnostics_function_not_configured', {
        correlationId
      });
      return null;
    }

    logger.error('issue_diagnostics_enqueue_failed', {
      message: error.message,
      correlationId
    });
    return null;
  }
}

module.exports = {
  enqueueIssueDiagnostics
};
