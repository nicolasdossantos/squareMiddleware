/**
 * Comprehensive Webhook Service
 * Implements the same functionality as the old Azure Functions PostCallWebhook
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { logPerformance, logEvent, logError, logSecurityEvent } = require('../utils/logger');
const { config } = require('../config');

/**
 * Helper function to verify ElevenLabs HMAC signature (same as old version)
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!signature) {
    return false;
  }

  try {
    const parts = signature.split(',');
    const timestamp = parts[0].substring(2); // Remove 't=' prefix
    const hash = parts[1]; // v0=hash

    // Validate timestamp (within 30 minutes)
    const now = Math.floor(Date.now() / 1000);
    const timestampInt = parseInt(timestamp);
    if (now - timestampInt > 30 * 60) {
      return false;
    }

    // Calculate expected signature
    const fullPayload = `${timestamp}.${payload}`;
    const expectedHash = `v0=${crypto.createHmac('sha256', secret).update(fullPayload, 'utf8').digest('hex')}`;

    // Compare signatures
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
  } catch (error) {
    logError(error, { operation: 'verifyWebhookSignature' });
    return false;
  }
}

/**
 * Helper function to sanitize input for email content
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Helper function to create collapsible JSON section (same as old version)
 */
function createCollapsibleJson(title, data, isOpen = false) {
  const jsonString = JSON.stringify(data, null, 2);
  const isLong = jsonString.length > 200;

  if (!isLong) {
    const preStyle =
      'background: #f8f9fa; padding: 10px; border-radius: 5px; overflow-x: auto; ' +
      'font-size: 12px; border: 1px solid #e9ecef;';
    return `
      <div style="margin: 10px 0;">
        <h4 style="color: #2c3e50; margin-bottom: 5px;">${title}</h4>
        <pre style="${preStyle}">${jsonString}</pre>
      </div>
    `;
  }

  const summaryStyle =
    'cursor: pointer; font-weight: bold; color: #2c3e50; background: #f8f9fa; ' +
    'padding: 10px; border-radius: 5px; border: 1px solid #e9ecef;';
  const preStyleOpen =
    'background: #f8f9fa; padding: 10px; border-radius: 0 0 5px 5px; overflow-x: auto; ' +
    'font-size: 12px; border: 1px solid #e9ecef; border-top: none; margin-top: 0;';

  return `
    <div style="margin: 10px 0;">
      <details ${isOpen ? 'open' : ''}>
        <summary style="${summaryStyle}">
          ${title} (${jsonString.length} chars) - Click to ${isOpen ? 'collapse' : 'expand'}
        </summary>
        <pre style="${preStyleOpen}">${jsonString}</pre>
      </details>
    </div>
  `;
}

/**
 * Helper function to create transcript section (same as old version)
 */
function createTranscriptSection(transcript) {
  // Handle both string and array formats
  if (!transcript) {
    return '<p>No transcript available</p>';
  }

  // If transcript is a string, format it nicely
  if (typeof transcript === 'string') {
    const sanitizedTranscript = sanitizeInput(transcript);
    const formattedTranscript = sanitizedTranscript
      .split('\n')
      .map(line => {
        if (line.trim().startsWith('Customer:') || line.trim().startsWith('User:')) {
          return `<p style="margin: 10px 0; border-left: 4px solid #2ecc71; padding-left: 15px;">
          <strong>👤 Customer:</strong> ${line.replace(/^(Customer:|User:)\s*/, '')}</p>`;
        } else if (line.trim().startsWith('Agent:') || line.trim().startsWith('AI:')) {
          return `<p style="margin: 10px 0; border-left: 4px solid #3498db; padding-left: 15px;">
          <strong>🤖 Agent:</strong> ${line.replace(/^(Agent:|AI:)\s*/, '')}</p>`;
        } else if (line.trim()) {
          return `<p style="margin: 5px 0;">${line}</p>`;
        }
        return '';
      })
      .filter(line => line)
      .join('');

    return formattedTranscript || '<p>No transcript content available</p>';
  }

  // If transcript is an array (original format)
  if (Array.isArray(transcript) && transcript.length === 0) {
    return '<p>No transcript available</p>';
  }

  let html = '';

  transcript.forEach(turn => {
    const timeInCall = turn.time_in_call_secs ? `${turn.time_in_call_secs}s` : 'N/A';
    const roleIcon = turn.role === 'agent' ? '🤖' : '👤';
    const roleName = turn.role === 'agent' ? 'Agent' : 'User';

    const turnBorderColor = turn.role === 'agent' ? '#3498db' : '#2ecc71';
    const turnStyle = `margin: 15px 0; border-left: 4px solid ${turnBorderColor}; padding-left: 15px;`;
    const messageHtml = turn.message
      ? `<p style="margin: 5px 0; font-style: italic;">"${sanitizeInput(turn.message)}"</p>`
      : '';

    const toolCallsHtml =
      turn.tool_calls && turn.tool_calls.length > 0
        ? `
      <div style="margin: 10px 0;">
        <h5 style="color: #f39c12; margin: 5px 0;">🔧 Tool Calls:</h5>
        ${turn.tool_calls
          .map((call, i) => {
            const callStyle =
              'background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 5px; ' +
              'border: 1px solid #ffeaa7;';
            return `
            <div style="${callStyle}">
              <strong>${call.tool_name || 'Unknown Tool'}</strong>
              ${createCollapsibleJson(`Tool Call ${i + 1} Details`, call)}
            </div>
          `;
          })
          .join('')}
      </div>
    `
        : '';

    const toolResultsHtml =
      turn.tool_results && turn.tool_results.length > 0
        ? `
      <div style="margin: 10px 0;">
        <h5 style="color: #27ae60; margin: 5px 0;">📊 Tool Results:</h5>
        ${turn.tool_results
          .map((result, i) => {
            const resultStyle =
              'background: #d4edda; padding: 10px; margin: 5px 0; border-radius: 5px; ' +
              'border: 1px solid #c3e6cb;';
            const latencySpan = result.tool_latency_secs
              ? `<span style="color: #6c757d;"> (${result.tool_latency_secs.toFixed(2)}s)</span>`
              : '';
            return `
            <div style="${resultStyle}">
              <strong>${result.tool_name || 'Unknown Tool'}</strong> - ${result.is_error ? '❌ Error' : '✅ Success'}
              ${latencySpan}
              ${createCollapsibleJson(`Tool Result ${i + 1} Details`, result)}
            </div>
          `;
          })
          .join('')}
      </div>
    `
        : '';

    const llmUsageHtml = turn.llm_usage ? createCollapsibleJson('LLM Usage', turn.llm_usage) : '';
    const metricsHtml = turn.conversation_turn_metrics
      ? createCollapsibleJson('Turn Metrics', turn.conversation_turn_metrics)
      : '';

    html += `
      <div style="${turnStyle}">
        <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${roleIcon} ${roleName} (${timeInCall})</h4>
        ${messageHtml}
        ${toolCallsHtml}
        ${toolResultsHtml}
        ${llmUsageHtml}
        ${metricsHtml}
      </div>
    `;
  });

  return html;
}

/**
 * Helper function to create comprehensive email HTML content (same as old version)
 */
function createEmailContent(requestBody, toolsUsed = 0) {
  const conversationData = requestBody.data;
  const metadata = conversationData.metadata || {};
  const analysis = conversationData.analysis || {};

  // Extract basic info
  const conversationId = conversationData.conversation_id || 'Unknown';
  const agentId = conversationData.agent_id || 'Unknown';
  const status = conversationData.status || 'Unknown';
  const timestamp = requestBody.event_timestamp
    ? new Date(requestBody.event_timestamp * 1000).toISOString()
    : new Date().toISOString();

  // Calculate call duration
  const callDuration = metadata.call_duration_secs
    ? `${Math.floor(metadata.call_duration_secs / 60)}m ${metadata.call_duration_secs % 60}s`
    : 'Unknown';

  // Extract customer info from conversation initiation data
  const dynamicVars = conversationData.conversation_initiation_client_data?.dynamic_variables || {};
  const firstName = dynamicVars.customer_first_name || '';
  const lastName = dynamicVars.customer_last_name || '';
  const customerName = `${firstName} ${lastName}`.trim() || 'Unknown Customer';
  const customerPhone = dynamicVars.customer_phone || dynamicVars.caller_id || 'Unknown';

  // Handle transcript format for cost calculation only
  const transcriptArray = Array.isArray(conversationData.transcript) ? conversationData.transcript : [];

  // Calculate total costs
  const totalCost =
    transcriptArray.reduce((cost, turn) => {
      if (turn.llm_usage?.model_usage) {
        Object.values(turn.llm_usage.model_usage).forEach(usage => {
          if (usage.input?.price) cost += usage.input.price;
          if (usage.output_total?.price) cost += usage.output_total.price;
        });
      }
      return cost;
    }, 0) || 0;

  const headerBg = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const headerStyle = `background: ${headerBg}; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;`;
  const sectionStyle =
    'background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 8px; ' + 'border: 1px solid #e9ecef;';
  const metricStyle =
    'display: inline-block; margin: 10px; padding: 10px; background: white; ' +
    'border-radius: 5px; border: 1px solid #dee2e6;';
  const footerStyle =
    'margin-top: 30px; padding: 20px; border-top: 2px solid #e9ecef; ' +
    'color: #6c757d; text-align: center;';

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { ${headerStyle} }
          .section { ${sectionStyle} }
          .metric { ${metricStyle} }
          .success { color: #27ae60; }
          .error { color: #e74c3c; }
          .warning { color: #f39c12; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
          details summary { padding: 10px; }
          details[open] summary { border-bottom: 1px solid #e9ecef; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📞 ElevenLabs Post-Call Webhook Report</h1>
          <p><strong>Conversation ID:</strong> ${conversationId}</p>
          <p><strong>Agent ID:</strong> ${agentId}</p>
          <p><strong>Status:</strong> ${status}</p>
          <p><strong>Timestamp:</strong> ${timestamp}</p>
        </div>
        
        <div class="section">
          <h2 style="color: #2c3e50; margin-top: 0;">📊 Call Summary</h2>
          <div class="metric">
            <strong>Customer:</strong> ${sanitizeInput(customerName)}<br>
            <strong>Phone:</strong> ${sanitizeInput(customerPhone)}
          </div>
          <div class="metric">
            <strong>Duration:</strong> ${callDuration}<br>
            <strong>Tools Used:</strong> ${toolsUsed}
          </div>
          <div class="metric">
            <strong>Total Cost:</strong> $${totalCost.toFixed(4)}<br>
            <strong>Type:</strong> ${requestBody.type}
          </div>
        </div>
        
        ${
          analysis.transcript_summary
            ? `
          <div class="section">
            <h2 style="color: #2c3e50; margin-top: 0;">📝 AI Summary</h2>
            <p>${sanitizeInput(analysis.transcript_summary).replace(/\n/g, '<br>')}</p>
          </div>
        `
            : ''
        }
        
        <div class="section">
          <h2 style="color: #2c3e50; margin-top: 0;">💬 Conversation Transcript</h2>
          ${createTranscriptSection(conversationData.transcript)}
        </div>
        
        ${
          metadata
            ? `
          <div class="section">
            <h2 style="color: #2c3e50; margin-top: 0;">📈 Metadata</h2>
            ${createCollapsibleJson('Complete Metadata', metadata, true)}
          </div>
        `
            : ''
        }
        
        ${
          analysis
            ? `
          <div class="section">
            <h2 style="color: #2c3e50; margin-top: 0;">🔍 Analysis</h2>
            ${createCollapsibleJson('Complete Analysis', analysis)}
          </div>
        `
            : ''
        }
        
        ${
          conversationData.conversation_initiation_client_data
            ? `
          <div class="section">
            <h2 style="color: #2c3e50; margin-top: 0;">🎯 Client Data</h2>
            ${createCollapsibleJson(
              'Conversation Initiation Client Data',
              conversationData.conversation_initiation_client_data
            )}
          </div>
        `
            : ''
        }
        
        <div class="section">
          <h2 style="color: #2c3e50; margin-top: 0;">🔄 Complete Webhook Payload</h2>
          ${createCollapsibleJson('Full Request Body', requestBody)}
        </div>
        
        <footer style="${footerStyle}">
          <p><strong>AI Booking System</strong></p>
          <p>Post-Call Webhook Integration</p>
          <p>Generated: ${new Date().toISOString()}</p>
        </footer>
      </body>
    </html>
  `;
}

/**
 * Helper function to create email transporter (same as old version)
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
 * Process ElevenLabs post-call webhook with comprehensive functionality
 */
async function processElevenLabsPostCall(webhookData, correlationId) {
  const startTime = Date.now();

  try {
    logEvent('elevenlabs_webhook_process_start', {
      correlationId,
      type: webhookData.type,
      hasData: !!webhookData.data
    });

    // Validate webhook structure
    if (!webhookData.type || !webhookData.data) {
      throw new Error('Missing required fields: type and data');
    }

    // Handle post-call transcription webhook (same as old version)
    if (webhookData.type === 'post_call_transcription') {
      const conversationData = webhookData.data;

      logEvent('post_call_transcription_processing', {
        correlationId,
        conversationId: conversationData.conversation_id,
        agentId: conversationData.agent_id,
        status: conversationData.status
      });

      // Extract customer information for subject line (sanitized)
      const dynamicVars = conversationData.conversation_initiation_client_data?.dynamic_variables || {};
      const firstName = dynamicVars.customer_first_name || '';
      const lastName = dynamicVars.customer_last_name || '';
      const customerName = `${firstName} ${lastName}`.trim() || 'Unknown Customer';

      // Count tools used (same logic as old Azure Functions version)
      const transcriptArray = Array.isArray(conversationData.transcript) ? conversationData.transcript : [];

      const toolsUsed =
        transcriptArray.reduce((count, turn) => {
          return count + (turn.tool_calls?.length || 0);
        }, 0) ||
        conversationData.tools?.length ||
        0;

      // Create comprehensive email content with toolsUsed
      const emailHtml = createEmailContent(webhookData, toolsUsed);

      // Send email with comprehensive report
      const transporter = createEmailTransporter();

      const mailOptions = {
        from: config.email.from, // This should be hello@fluentfront.ai
        to: process.env.EMAIL_TO, // Use EMAIL_TO from environment
        subject: `📞 Complete Call Report - ${customerName} (${conversationData.conversation_id})`,
        html: emailHtml
      };

      await transporter.sendMail(mailOptions);

      // Track successful processing (use toolsUsed from earlier calculation)
      logEvent('post_call_email_sent', {
        correlationId,
        conversationId: conversationData.conversation_id,
        customerName,
        callDuration: conversationData.metadata?.call_duration_secs,
        toolsUsed
      });

      logPerformance(correlationId, 'processElevenLabsPostCall', startTime, {
        conversationId: conversationData.conversation_id,
        success: true,
        toolsProcessed: toolsUsed
      });

      return {
        processed: true,
        conversationId: conversationData.conversation_id,
        customerName,
        emailSent: true,
        toolsProcessed: toolsUsed,
        type: 'post_call_transcription',
        summary: `Processed post-call transcription for ${customerName} (${conversationData.conversation_id})`
      };
    }

    // Handle audio webhook (if needed in the future)
    else if (webhookData.type === 'post_call_audio') {
      logEvent('post_call_audio_received', {
        correlationId,
        conversationId: webhookData.data?.conversation_id
      });

      return {
        processed: true,
        type: 'post_call_audio',
        summary: 'Audio webhook received but not processed'
      };
    }

    // Unknown webhook type
    else {
      throw new Error(`Webhook type '${webhookData.type}' is not supported`);
    }
  } catch (error) {
    logError(error, {
      operation: 'processElevenLabsPostCall',
      correlationId,
      webhookType: webhookData.type
    });

    throw new Error(`Failed to process ElevenLabs webhook: ${error.message}`);
  }
}

module.exports = {
  verifyWebhookSignature,
  processElevenLabsPostCall,
  createEmailContent,
  createTranscriptSection,
  createCollapsibleJson,
  sanitizeInput
};
