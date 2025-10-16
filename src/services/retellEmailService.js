/**
 * Retell Post-Call Email Service
 * Sends comprehensive email reports for Retell call_analyzed events
 */

const nodemailer = require('nodemailer');
const { logEvent, logError } = require('../utils/logger');
const { config } = require('../config');

/**
 * Create email transporter (reusing existing configuration)
 */
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    requireTLS: true,
    auth: {
      user: config.email.user,
      pass: config.email.password
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Format call duration
 */
function formatDuration(durationMs) {
  if (!durationMs) return 'Unknown';
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format cost with alert styling if high
 * @param {number} costInCents - Cost in cents from Retell API
 * @param {number} threshold - Threshold in dollars for high cost alert
 */
function formatCost(costInCents, threshold = 10) {
  const costInDollars = costInCents / 100; // Convert cents to dollars
  const formatted = `$${costInDollars.toFixed(2)}`;
  const isHigh = costInDollars > threshold;
  return {
    formatted,
    isHigh,
    color: isHigh ? '#e74c3c' : '#27ae60'
  };
}

/**
 * Create HTML email content for Retell call analysis
 */
function createRetellEmailContent(callData, businessName = null) {
  const call = callData.call;
  const analysis = call.call_analysis || {};

  // Check if this is a spam identification call
  const currentAgentState = call?.collected_dynamic_variables?.current_agent_state;
  const isSpamCall = currentAgentState === 'identify_spam_call';

  // Extract business name from various possible sources
  const extractedBusinessName =
    businessName || // Passed as parameter
    call.retell_llm_dynamic_variables?.business_name || // From Retell dynamic vars
    call.agent_metadata?.business_name || // From agent metadata
    'Elite Barber Boutique'; // Default fallback

  // Extract key information
  const customerName = call.retell_llm_dynamic_variables?.customer_first_name || 'Unknown Customer';
  const customerFullName = call.retell_llm_dynamic_variables?.customer_full_name || customerName;
  const customerPhone = call.from_number || 'Unknown';
  const callStatus = call.call_status;
  const isSuccessful = analysis.call_successful;
  const sentiment = analysis.user_sentiment;
  const isNegative = sentiment === 'Negative';
  // Don't mark spam identification calls as issues
  const isIssue = !isSpamCall && (!isSuccessful || isNegative);

  // Format costs (convert from cents to dollars)
  const totalCost = formatCost(call.call_cost?.combined_cost || 0);
  const ttsCost = (call.call_cost?.product_costs?.find(p => p.product.includes('tts'))?.cost || 0) / 100;
  const llmCost = (call.call_cost?.product_costs?.find(p => p.product.includes('gpt'))?.cost || 0) / 100;

  // Format latency
  const latency = call.latency || {};
  const avgE2E = latency.e2e?.p50 ? `${Math.round(latency.e2e.p50)}ms` : 'Unknown';
  const avgLLM = latency.llm?.p50 ? `${Math.round(latency.llm.p50)}ms` : 'Unknown';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; 
        border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: ${isIssue ? '#e74c3c' : '#3498db'}; color: white; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; ${isIssue ? 'font-weight: bold;' : ''} }
        .section { padding: 20px; border-bottom: 1px solid #eee; }
        .section:last-child { border-bottom: none; }
        .section h2 { color: #2c3e50; margin-top: 0; font-size: 18px; 
        border-bottom: 2px solid #3498db; padding-bottom: 5px; }
        .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0; }
        .data-item { background: #f8f9fa; padding: 12px; border-radius: 5px; border-left: 4px solid #3498db; }
        .data-label { font-weight: bold; color: #2c3e50; font-size: 12px; 
        text-transform: uppercase; margin-bottom: 5px; }
        .data-value { font-size: 16px; color: #34495e; }
        .alert { background: #fee; border-left-color: #e74c3c; }
        .alert .data-label { color: #e74c3c; }
        .success { background: #efe; border-left-color: #27ae60; }
        .success .data-label { color: #27ae60; }
        .cost-high { color: #e74c3c; font-weight: bold; }
        .cost-normal { color: #27ae60; }
        .transcript { background: #f8f9fa; padding: 15px; border-radius: 5px; 
        border: 1px solid #dee2e6; margin: 10px 0; }
        .transcript-text { font-style: italic; color: #495057; line-height: 1.5; }
        .metadata { font-size: 12px; color: #6c757d; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        
        <!-- Header -->
        <div class="header">
          <h1>${isIssue ? '🚨 CALL ISSUE DETECTED' : isSpamCall ? '🚫 SPAM CALL DETECTED' : '📞 Call Report'}</h1>
          <div style="font-size: 18px; margin-top: 5px; font-weight: bold;">
            ${extractedBusinessName}
          </div>
          <div style="font-size: 16px; margin-top: 10px;">
            ${customerFullName} • ${formatTimestamp(call.start_timestamp)}
          </div>
        </div>

        <!-- Call Overview -->
        <div class="section">
          <h2>📋 Call Overview</h2>
          <div class="data-grid">
            <div class="data-item ${isSuccessful ? 'success' : 'alert'}">
              <div class="data-label">Call Successful</div>
              <div class="data-value">${isSuccessful ? '✅ Yes' : '❌ No'}</div>
            </div>
            <div class="data-item ${isNegative ? 'alert' : 'success'}">
              <div class="data-label">Customer Sentiment</div>
              <div class="data-value">
              ${sentiment || 'Unknown'} ${sentiment === 'Positive' ? '😊' : sentiment === 'Negative' ? '😞' : '😐'}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Call Status</div>
              <div class="data-value">${callStatus}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Duration</div>
              <div class="data-value">${formatDuration(call.duration_ms)}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Customer Phone</div>
              <div class="data-value">${customerPhone}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Call ID</div>
              <div class="data-value">${call.call_id}</div>
            </div>
          </div>
        </div>

        <!-- Business Information -->
        <div class="section">
          <h2>💼 Business Information</h2>
          <div class="data-grid">
            <div class="data-item">
              <div class="data-label">Customer Name</div>
              <div class="data-value">${customerFullName}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Is Returning Customer</div>
              <div class="data-value">
              ${call.retell_llm_dynamic_variables?.is_returning_customer === 'true' ? '✅ Yes' : '❌ No'}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Agent State</div>
              <div class="data-value">${call.collected_dynamic_variables?.current_agent_state || 'Unknown'}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Voicemail</div>
              <div class="data-value">${analysis.in_voicemail ? '📧 Yes' : '📞 No'}</div>
            </div>
          </div>
        </div>

        <!-- Cost Analysis -->
        <div class="section">
          <h2>💰 Cost Analysis</h2>
          <div class="data-grid">
            <div class="data-item ${totalCost.isHigh ? 'alert' : ''}">
              <div class="data-label">Total Call Cost</div>
              <div class="data-value" style="color: ${totalCost.color}; 
              ${totalCost.isHigh ? 'font-weight: bold;' : ''}">${totalCost.formatted}</div>
            </div>
            <div class="data-item">
              <div class="data-label">TTS Cost</div>
              <div class="data-value">$${ttsCost.toFixed(2)}</div>
            </div>
            <div class="data-item">
              <div class="data-label">LLM Cost</div>
              <div class="data-value">$${llmCost.toFixed(2)}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Call Duration Seconds</div>
              <div class="data-value">${call.call_cost?.total_duration_seconds || 0}s</div>
            </div>
          </div>
        </div>

        <!-- Performance Metrics -->
        <div class="section">
          <h2>⚡ Performance Metrics</h2>
          <div class="data-grid">
            <div class="data-item">
              <div class="data-label">Average E2E Latency</div>
              <div class="data-value">${avgE2E}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Average LLM Latency</div>
              <div class="data-value">${avgLLM}</div>
            </div>
            <div class="data-item">
              <div class="data-label">LLM Requests</div>
              <div class="data-value">${call.llm_token_usage?.num_requests || 0}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Avg Tokens/Request</div>
              <div class="data-value">${Math.round(call.llm_token_usage?.average || 0)}</div>
            </div>
          </div>
        </div>

        <!-- Call Analysis -->
        <div class="section">
          <h2>🔍 Call Analysis</h2>
          <div class="transcript">
            <div class="data-label">Summary</div>
            <div class="transcript-text">${analysis.call_summary || 'No summary available'}</div>
          </div>
          
          <div class="transcript" style="margin-top: 15px;">
            <div class="data-label">Transcript Preview</div>
            <div class="transcript-text">
            ${call.transcript ? call.transcript.substring(0, 300) + '...' : 'No transcript available'}</div>
          </div>
        </div>

        <!-- Call Details & Resources -->
        <div class="section">
          <h2>📋 Call Details & Resources</h2>
          <div class="data-grid">
            <div class="data-item">
              <div class="data-label">Disconnection Reason</div>
              <div class="data-value">${call.disconnection_reason || 'Unknown'}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Call Direction</div>
              <div class="data-value">${call.direction || 'Unknown'}</div>
            </div>
          </div>
          
          ${
            call.recording_url
              ? `
          <div class="transcript" style="margin-top: 15px;">
            <div class="data-label">📹 Call Recording</div>
            <div class="transcript-text">
              <a href="${call.recording_url}" target="_blank" 
              style="color: #3498db; text-decoration: none; font-weight: bold;">
                🎵 Listen to Recording
              </a>
              <br><small style="color: #6c757d;">Click to open recording in new tab</small>
            </div>
          </div>
          `
              : ''
          }
          
          ${
            call.public_log_url
              ? `
          <div class="transcript" style="margin-top: 15px;">
            <div class="data-label">📊 Public Log</div>
            <div class="transcript-text">
              <a href="${call.public_log_url}" target="_blank" 
              style="color: #3498db; text-decoration: none; font-weight: bold;">
                📋 View Call Logs
              </a>
              <br><small style="color: #6c757d;">Technical logs and debugging information</small>
            </div>
          </div>
          `
              : ''
          }
        </div>

        <!-- Detailed Transcript with Tool Calls -->
        ${
          call.transcript_with_tool_calls && call.transcript_with_tool_calls.length > 0
            ? `
        <div class="section">
          <h2>🤖 Detailed Transcript with AI Actions</h2>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; 
          border: 1px solid #dee2e6; max-height: 400px; overflow-y: auto;">
            ${call.transcript_with_tool_calls
              .map((turn, index) => {
                if (turn.role === 'agent') {
                  return `
                <div style="margin: 10px 0; padding: 10px; background: #e3f2fd; 
                border-left: 4px solid #2196f3; border-radius: 4px;">
                  <strong style="color: #1976d2;">🤖 Agent:</strong> ${turn.content}
                  ${
                    turn.metadata?.response_id !== undefined
                      ? `<br><small style="color: #666;">Response ID: ${turn.metadata.response_id}</small>`
                      : ''
                  }
                </div>`;
                } else if (turn.role === 'user') {
                  return `
                <div style="margin: 10px 0; padding: 10px; background: #f3e5f5; 
                border-left: 4px solid #9c27b0; border-radius: 4px;">
                  <strong style="color: #7b1fa2;">👤 Customer:</strong> ${turn.content}
                </div>`;
                } else if (turn.role === 'tool_call_invocation') {
                  return `
                <div style="margin: 10px 0; padding: 10px; background: #fff3e0; 
                border-left: 4px solid #ff9800; border-radius: 4px;">
                  <strong style="color: #f57c00;">🔧 AI Action:</strong> ${turn.name}
                  ${
                    turn.arguments
                      ? `<br><small style="color: #666; font-family: monospace;">
                  ${turn.arguments}</small>`
                      : ''
                  }
                </div>`;
                }
                return '';
              })
              .join('')}
          </div>
          <div style="margin-top: 10px; font-size: 12px; color: #6c757d;">
            💡 This shows the complete conversation including AI tool calls and actions
          </div>
        </div>
        `
            : ''
        }

        <!-- Footer -->
        <div class="section" style="text-align: center; background: #f8f9fa;">
          <div class="metadata">
            <strong>${extractedBusinessName}</strong><br>
            <strong>Retell AI Call Analysis</strong><br>
            Generated: ${new Date().toLocaleString()}<br>
            Call ID: ${call.call_id}
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
}

/**
 * Send Retell post-call email notification
 */
async function sendRetellPostCallEmail(callData, correlationId) {
  try {
    const call = callData.call;
    const analysis = call.call_analysis || {};

    // Check if customer ever spoke during the call
    const transcript = call.transcript || '';
    const transcriptWithToolCalls = call.transcript_with_tool_calls || [];

    // Check if there are any user/customer messages in the transcript
    const customerSpoke = transcriptWithToolCalls.some(
      turn => turn.role === 'user' && turn.content && turn.content.trim().length > 0
    );

    // Alternative check: see if transcript contains actual conversation (not just agent speaking)
    const hasRealConversation = transcript.length > 50 && customerSpoke;

    // Don't send email if customer never spoke
    if (!hasRealConversation && !customerSpoke) {
      logEvent('retell_email_skipped_no_customer_speech', {
        correlationId,
        callId: call.call_id,
        transcriptLength: transcript.length,
        reason: 'Customer never spoke during the call'
      });

      return {
        success: true,
        skipped: true,
        message: 'Email skipped - customer never spoke during the call'
      };
    }

    // Check if this is a spam identification call
    const currentAgentState = call?.collected_dynamic_variables?.current_agent_state;
    const isSpamCall = currentAgentState === 'identify_spam_call';

    // Extract business name from call data
    const businessName =
      call.retell_llm_dynamic_variables?.business_name ||
      call.agent_metadata?.business_name ||
      'Elite Barber Boutique'; // Default fallback

    // Extract customer info for subject
    const customerName = call.retell_llm_dynamic_variables?.customer_first_name || 'Unknown Customer';
    const isSuccessful = analysis.call_successful;
    const sentiment = analysis.user_sentiment;
    // Don't mark spam identification calls as issues
    subject = `�️ ${businessName} - Spam Call Detected`;

    // Create subject line
    let subject;
    if (isSpamCall) {
      // Special case for spam identification calls
      subject = `🗑️ ${businessName} - Spam Call Detected`;
    } else if (isIssue) {
      const issueType = !isSuccessful ? 'Failed Call' : 'Negative Sentiment';
      subject = `🚨 ${businessName} - ${customerName} - ${issueType}`;
    } else {
      subject = `✅ ${businessName} - Call Report - ${customerName}`;
    }

    // Create email content
    const emailHtml = createRetellEmailContent(callData, businessName);

    // Send email
    const transporter = createEmailTransporter();
    const mailOptions = {
      from: config.email.from,
      to: process.env.EMAIL_TO,
      subject: subject,
      html: emailHtml
    };

    logEvent('retell_email_sending', {
      correlationId,
      callId: call.call_id,
      customerName,
      isIssue: isSpamCall ? false : isIssue, // Spam calls are not considered issues
      isSpamCall,
      totalCost: (call.call_cost?.combined_cost || 0) / 100 // Convert cents to dollars for logging
    });

    await transporter.sendMail(mailOptions);

    logEvent('retell_email_sent_success', {
      correlationId,
      callId: call.call_id,
      to: process.env.EMAIL_TO,
      subject
    });

    return {
      success: true,
      message: 'Retell post-call email sent successfully'
    };
  } catch (error) {
    logError(error, {
      operation: 'sendRetellPostCallEmail',
      correlationId,
      callId: callData?.call?.call_id
    });

    throw new Error(`Failed to send Retell post-call email: ${error.message}`);
  }
}

module.exports = {
  sendRetellPostCallEmail
};
