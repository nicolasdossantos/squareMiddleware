/**
 * Retell AI Webhook Controller
 * Handles Retell AI webhook events (call_started and call_analyzed)
 */

const { sendSuccess, sendError } = require('../utils/responseBuilder');
const { logPerformance, logEvent, logSecurityEvent } = require('../utils/logger');
const customerService = require('../services/customerService');
const retellWebhookService = require('../services/retellWebhookService');
const retellEmailService = require('../services/retellEmailService');
const agentConfigService = require('../services/agentConfigService');
const sessionStore = require('../services/sessionStore');
const { config } = require('../config');

/**
 * Handle Retell AI webhook events
 * Supports both call_started and call_analyzed events
 */
async function handleRetellWebhook(req, res) {
  const startTime = Date.now();
  const { correlationId } = req;
  let webhookData; // Declare outside try block so it's accessible in catch block

  try {
    // Log webhook request details at debug level
    logEvent(req, 'retell_webhook_received', {
      method: req.method,
      url: req.url,
      bodyType: typeof req.body,
      hasHeaders: !!req.headers['x-retell-signature']
    });

    webhookData = req.body;

    // Handle case where body is completely empty or malformed
    if (!webhookData) {
      return sendError(res, 'Request body is required', 400, 'No request body received', correlationId);
    }

    if (typeof webhookData !== 'object') {
      return sendError(
        res,
        'Invalid request body format',
        400,
        `Expected JSON object, got ${typeof webhookData}`,
        correlationId
      );
    }

    if (Array.isArray(webhookData)) {
      return sendError(
        res,
        'Invalid request body format',
        400,
        'Expected JSON object, got array',
        correlationId
      );
    }

    logEvent('retell_webhook_received', {
      correlationId,
      event: webhookData?.event,
      callId: webhookData?.call?.call_id,
      fromNumber: webhookData?.call?.from_number,
      bodyType: typeof webhookData,
      bodyKeys: Object.keys(webhookData || {}),
      hasEvent: !!webhookData?.event,
      hasCall: !!webhookData?.call
    });

    // Validate webhook structure - handle both regular call webhooks and inbound call webhooks
    if (!webhookData.event) {
      return sendError(
        res,
        'Missing required field: event',
        400,
        {
          received_fields: Object.keys(webhookData),
          event_value: webhookData.event
        },
        correlationId
      );
    }

    // For inbound call webhooks, we need call_inbound instead of call
    if (webhookData.event === 'call_inbound') {
      if (!webhookData.call_inbound) {
        return sendError(
          res,
          'Missing required field: call_inbound',
          400,
          {
            received_fields: Object.keys(webhookData || {}),
            expected: 'call_inbound object with from_number, to_number, agent_id'
          },
          correlationId
        );
      }
    } else {
      // For regular call webhooks (call_started, call_analyzed, call_ended)
      if (!webhookData.call) {
        return sendError(
          res,
          'Missing required field: call',
          400,
          {
            received_fields: Object.keys(webhookData),
            call_value: webhookData.call
          },
          correlationId
        );
      }
    }

    const { event } = webhookData;
    const call = webhookData.call || null;
    const call_inbound = webhookData.call_inbound || null;

    // Get tenant context from request (set by tenantContext middleware)
    const { tenant } = req;

    let result;

    switch (event) {
      case 'call_started':
        result = await handleCallStarted(call, correlationId, tenant);
        break;

      case 'call_analyzed':
        result = await handleCallAnalyzed(call, correlationId);
        break;

      case 'call_ended':
        result = await handleCallEnded(call, correlationId);
        break;

      case 'call_inbound':
        // Handle inbound call webhook - different format than regular calls
        result = await handleCallInbound(call_inbound, correlationId);
        break;

      case 'inbound':
        // Handle legacy inbound call event - treat it similar to call_started
        result = await handleCallStarted(call, correlationId, tenant);
        break;

      default:
        logEvent('retell_webhook_unhandled', {
          correlationId,
          event,
          callId: call.call_id
        });
        return sendError(res, `Unsupported event type: ${event}`, 400, null, correlationId);
    }

    logPerformance(correlationId, 'retell_webhook', startTime, {
      event,
      callId: call?.call_id || call_inbound?.agent_id || 'unknown',
      processed: result.processed
    });

    logEvent('retell_webhook_processed', {
      correlationId,
      event,
      callId: call?.call_id || call_inbound?.agent_id || 'unknown',
      result: result.summary
    });

    // For inbound call webhooks, return JSON configuration with call_inbound field
    if (event === 'call_inbound') {
      console.log(
        '🔍 [RETELL DEBUG] Customer response data:',
        JSON.stringify(result.customerResponse, null, 2)
      );

      // Extract dynamic variables from customer response - handle both success and error cases
      let dynamicVariables = {};

      // Get business name from tenant context - use actual name, not 'us'
      const businessName = result.tenant?.businessName || 'Elite Barbershop';
      console.log(
        '🔍 [RETELL DEBUG] Business name extraction:',
        JSON.stringify(
          {
            result_tenant: result.tenant,
            businessName: businessName,
            tenant_businessName: result.tenant?.businessName,
            fallback_used: !result.tenant?.businessName
          },
          null,
          2
        )
      );

      if (result.customerResponse?.dynamic_variables) {
        // Customer lookup succeeded - use the full ElevenLabs response but ensure all values are strings
        const rawVariables = result.customerResponse.dynamic_variables;
        const customerFirstName = String(rawVariables.customer_first_name || '');
        const isReturning = String(rawVariables.is_returning_customer || 'false') === 'true';

        // Generate personalized initial message
        let initialMessage;
        if (isReturning && customerFirstName) {
          initialMessage = `Thank you for calling ${businessName}, am I speaking to ${customerFirstName}?`;
        } else {
          initialMessage = `Thank you for calling ${businessName}, who am I speaking with today?`;
        }

        dynamicVariables = {
          customer_first_name: customerFirstName,
          customer_last_name: String(rawVariables.customer_last_name || ''),
          customer_full_name: String(rawVariables.customer_full_name || ''),
          customer_email: String(rawVariables.customer_email || ''),
          customer_phone: String(rawVariables.customer_phone || ''),
          customer_id: String(rawVariables.customer_id || ''),
          upcoming_bookings_json: String(rawVariables.upcoming_bookings_json || '[]'),
          booking_history_json: String(rawVariables.booking_history_json || '[]'),
          is_returning_customer: String(rawVariables.is_returning_customer || 'false'),
          current_datetime_store_timezone: String(rawVariables.current_datetime_store_timezone || ''),
          service_variations_json: String(rawVariables.service_variations_json || '{}'),
          staff_with_ids_json: String(rawVariables.staff_with_ids_json || '[]'),
          available_services: String(rawVariables.available_services || ''),
          available_staff: String(rawVariables.available_staff || ''),
          caller_id: String(rawVariables.caller_id || ''),
          initial_message: initialMessage
        };
      } else {
        // Customer lookup failed, provide default dynamic variables matching ElevenLabs format exactly
        const now = new Date();
        const currentDateTime = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        }).format(now);

        dynamicVariables = {
          customer_first_name: '',
          customer_last_name: '',
          customer_full_name: '',
          customer_email: '',
          customer_phone: result.fromNumber || '',
          customer_id: '',
          upcoming_bookings_json: '[]',
          booking_history_json: '[]',
          is_returning_customer: 'false',
          current_datetime_store_timezone: currentDateTime,
          service_variations_json: '{}',
          staff_with_ids_json: '[{"id":"default","name":"Our Team","displayName":"Our Team"}]',
          available_services: 'Hair Cut, Beard Trim, Hair Wash, Styling',
          available_staff: 'Our Team',
          caller_id: result.fromNumber ? result.fromNumber.replace(/\D/g, '').slice(-10) : '',
          initial_message: `Thank you for calling ${businessName}, who am I speaking with today?`
        };
      }
      // Add callId to dynamic variables so agent can use it in tool calls
      dynamicVariables.call_id = result.callId;
      console.log(
        '🔍 [RETELL DEBUG] Dynamic variables extracted:',
        JSON.stringify(dynamicVariables, null, 2)
      );

      const response = {
        call_inbound: {
          response_id: 0,
          content: dynamicVariables.initial_message || 'Thank you for calling, who am I speaking with today?',
          content_complete: true,
          end_call: false,
          // Include all dynamic variables from customer lookup
          dynamic_variables: dynamicVariables,
          // Add metadata with correlation ID for tracking
          metadata: {
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
            customer_lookup_success: result.customerResponse?.success || false
          }
        }
      };
      return res.status(200).json(response);
    }

    // For all other webhooks, acknowledge with 204 status (no content)
    // This is what Retell AI expects for regular webhooks
    return res.status(204).send();
  } catch (error) {
    // Log error with safe serialization (avoid circular references)
    logPerformance(correlationId, 'retell_webhook_error', startTime, {
      event: webhookData?.event,
      errorMessage: error.message || 'Unknown error',
      errorType: error.name || 'Error'
    });

    // Safe error details extraction (avoid circular references from Socket objects)
    const errorDetails = error.message || error.toString();

    // Return error response (prevent double-send)
    return sendError(res, 'Failed to process Retell webhook', 500, errorDetails, correlationId);
  }
}

/**
 * Handle call_started event
 * Uses from_number to get customer info (same format as ElevenLabs GetCustomerInfo)
 */
async function handleCallStarted(call, correlationId, tenant = null) {
  const { call_id, from_number, to_number, direction, agent_id } = call;

  logEvent('retell_call_started', {
    correlationId,
    callId: call_id,
    fromNumber: from_number ? `${from_number.substring(0, 5)}***` : 'unknown',
    direction
  });

  let useTenant = null;

  try {
    // Attempt to load credentials from active session first (created during call_inbound)
    let sessionTenant = null;
    let agentConfigTenant = null;

    if (call_id) {
      const session = sessionStore.getSession(call_id);

      if (session?.credentials?.squareAccessToken) {
        sessionTenant = {
          id: session.agentId || tenant?.id || 'default',
          squareAccessToken: session.credentials.squareAccessToken,
          squareLocationId: session.credentials.squareLocationId,
          squareEnvironment:
            session.credentials.squareEnvironment ||
            tenant?.squareEnvironment ||
            config.square.environment ||
            'sandbox',
          timezone:
            session.credentials.timezone || tenant?.timezone || config.server.timezone || 'America/New_York',
          businessName:
            session.credentials.businessName ||
            tenant?.businessName ||
            config.businessName ||
            'Elite Barbershop'
        };

        logEvent('retell_call_started_session_match', {
          correlationId,
          callId: call_id,
          tenantId: sessionTenant.id
        });
      } else {
        logEvent('retell_call_started_session_missing', {
          correlationId,
          callId: call_id
        });
      }
    }

    // Fallback to agent configuration if session not found
    if (!sessionTenant && agent_id) {
      try {
        const agentConfig = agentConfigService.getAgentConfig(agent_id);

        agentConfigTenant = {
          id: agentConfig.agentId || agent_id,
          accessToken: agentConfig.squareAccessToken,
          squareAccessToken: agentConfig.squareAccessToken,
          squareLocationId: agentConfig.squareLocationId,
          locationId: agentConfig.squareLocationId,
          squareEnvironment: agentConfig.squareEnvironment,
          environment: agentConfig.squareEnvironment,
          timezone: agentConfig.timezone,
          businessName: agentConfig.businessName
        };

        logEvent('retell_call_started_agent_config', {
          correlationId,
          callId: call_id,
          agentId: agentConfigTenant.id
        });
      } catch (configError) {
        logEvent('retell_call_started_agent_config_error', {
          correlationId,
          callId: call_id,
          agentId: agent_id,
          error: configError.message
        });
      }
    }

    // Use tenant from request or fall back to environment variables if session not found
    useTenant = sessionTenant ||
      agentConfigTenant ||
      tenant || {
        id: 'default',
        squareAccessToken: config.square.accessToken,
        squareLocationId: config.square.locationId,
        squareEnvironment: config.square.environment || 'sandbox',
        timezone: config.server.timezone || 'America/New_York',
        businessName: config.businessName || 'Elite Barbershop'
      };

    // Normalize token/environment fields so downstream logic always has expected shape
    if (!useTenant.squareAccessToken && useTenant.accessToken) {
      useTenant.squareAccessToken = useTenant.accessToken;
    }
    if (!useTenant.squareLocationId && useTenant.locationId) {
      useTenant.squareLocationId = useTenant.locationId;
    }
    if (!useTenant.squareEnvironment && useTenant.environment) {
      useTenant.squareEnvironment = useTenant.environment;
    }

    if (!useTenant.squareAccessToken) {
      logEvent('retell_call_started_missing_credentials', {
        correlationId,
        callId: call_id,
        tenantId: useTenant.id,
        tenantKeys: Object.keys(useTenant || {})
      });
    }

    // Use the same customer lookup logic as ElevenLabs GetCustomerInfo
    const customerController = require('./customerController');

    // Create a mock request/response to reuse the existing getCustomerInfoByPhone logic
    const mockReq = {
      body: { phone: from_number },
      correlationId: correlationId,
      tenant: useTenant // ✅ PASS TENANT CONTEXT
    };

    let customerResponse = null;
    const mockRes = {
      status: () => mockRes,
      json: data => {
        customerResponse = data;
        return mockRes;
      }
    };

    // Call the existing getCustomerInfoByPhone function to get exact ElevenLabs format
    await customerController.getCustomerInfoByPhone(mockReq, mockRes);

    // Return the exact same response format as ElevenLabs
    return {
      processed: true,
      event: 'call_started',
      callId: call_id,
      customerResponse: customerResponse, // This contains the full ElevenLabs format
      tenant: useTenant // Include tenant for business name access in webhook handler
    };
  } catch (error) {
    logEvent('retell_call_started_error', {
      correlationId,
      callId: call_id,
      error: error.message
    });

    // Get business name from tenant for error response
    const businessName = useTenant?.businessName || 'Elite Barbershop';

    // Return error in same format but with basic info
    return {
      processed: true,
      event: 'call_started',
      callId: call_id,
      error: error.message,
      customerResponse: {
        success: false,
        type: 'conversation_initiation_client_data',
        dynamic_variables: {
          customer_first_name: '',
          customer_last_name: '',
          customer_full_name: '',
          customer_email: '',
          customer_phone: from_number,
          customer_id: '',
          upcoming_bookings_json: '[]',
          booking_history_json: '[]',
          is_returning_customer: false,
          current_datetime_store_timezone: new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York'
          }),
          service_variations_json: '{}',
          staff_with_ids_json: '[]',
          available_services: '',
          available_staff: '',
          caller_id: from_number.replace(/\D/g, '').slice(-10),
          initial_message: `Thank you for calling ${businessName}, who am I speaking with today?`
        },
        correlation_id: correlationId
      }
    };
  }
}

/**
 * Handle call_analyzed event
 * Similar to PostCallWebhook processing - sends comprehensive email report
 */
async function handleCallAnalyzed(call, correlationId) {
  const { call_id, from_number, transcript, call_analysis } = call;

  logEvent('retell_call_analyzed', {
    correlationId,
    callId: call_id,
    fromNumber: from_number ? `${from_number.substring(0, 5)}***` : 'unknown',
    hasTranscript: !!transcript,
    hasAnalysis: !!call_analysis
  });

  try {
    // Send the post-call email report (THIS WAS MISSING!)
    let emailResult = null;
    try {
      emailResult = await retellEmailService.sendRetellPostCallEmail(
        { call }, // Wrap call in object to match expected structure
        correlationId
      );

      logEvent('retell_email_sent', {
        correlationId,
        callId: call_id,
        emailResult
      });
    } catch (emailError) {
      // Log email error but don't fail the webhook
      logEvent('retell_email_failed', {
        correlationId,
        callId: call_id,
        error: emailError.message
      });
    }

    // Process the call analysis (similar to ElevenLabs PostCallWebhook)
    const result = await retellWebhookService.processCallAnalysis({
      callId: call_id,
      fromNumber: from_number,
      transcript,
      analysis: call_analysis,
      correlationId
    });

    return {
      processed: true,
      event: 'call_analyzed',
      callId: call_id,
      emailSent: emailResult?.success || false,
      emailSkipped: emailResult?.skipped || false,
      ...result,
      summary: `Call analysis processed for ${call_id}${emailResult?.success ? ' (email sent)' : ''}`
    };
  } catch (error) {
    logEvent('retell_call_analyzed_error', {
      correlationId,
      callId: call_id,
      error: error.message
    });

    throw error;
  }
}

/**
 * Handle call_ended event
 * Simple acknowledgment and cleanup
 */
async function handleCallEnded(call, correlationId) {
  const { call_id, from_number, to_number, direction, end_timestamp } = call;

  logEvent('retell_call_ended', {
    correlationId,
    callId: call_id,
    fromNumber: from_number ? `${from_number.substring(0, 5)}***` : 'unknown',
    direction,
    endTimestamp: end_timestamp
  });

  try {
    // 🔐 CLEANUP SESSION: Destroy session when call ends
    // This invalidates all credentials and prevents further tool calls
    const destroyed = sessionStore.destroySession(call_id);

    if (destroyed) {
      logEvent('retell_session_destroyed', {
        correlationId,
        callId: call_id
      });
    }

    // Simple acknowledgment - no complex processing needed for call_ended
    return {
      processed: true,
      event: 'call_ended',
      callId: call_id,
      sessionDestroyed: destroyed,
      summary: `Call ended acknowledged for ${call_id}`
    };
  } catch (error) {
    logEvent('retell_call_ended_error', {
      correlationId,
      callId: call_id,
      error: error.message
    });

    // Even if there's an error, we should acknowledge the call_ended event
    return {
      processed: true,
      event: 'call_ended',
      callId: call_id,
      error: error.message,
      summary: `Call ended acknowledged with error for ${call_id}`
    };
  }
}

/**
 * Handle call_inbound event
 * Process inbound call webhook with different structure than regular calls
 */
async function handleCallInbound(call_inbound, correlationId) {
  const { agent_id, from_number, to_number } = call_inbound;

  logEvent('retell_call_inbound', {
    correlationId,
    agentId: agent_id,
    fromNumber: from_number ? `${from_number.substring(0, 5)}***` : 'unknown',
    toNumber: to_number ? `${to_number.substring(0, 5)}***` : 'unknown'
  });

  try {
    // 🔐 MULTI-TENANT: Fetch agent configuration from App Settings
    let tenant;
    try {
      const agentConfig = agentConfigService.getAgentConfig(agent_id);

      // Create tenant context from agent configuration
      tenant = {
        id: agentConfig.agentId || agent_id,
        accessToken: agentConfig.squareAccessToken, // ✅ FIX: Use 'accessToken' not 'squareAccessToken'
        locationId: agentConfig.squareLocationId,
        applicationId: agentConfig.squareApplicationId,
        environment: agentConfig.squareEnvironment,
        timezone: agentConfig.timezone,
        staffEmail: agentConfig.staffEmail,
        businessName: agentConfig.businessName
      };

    } catch (configError) {
      // Fallback to environment variables if config lookup fails
      console.warn(
        `⚠️ [RETELL DEBUG] Agent config lookup failed for agent ${agent_id}, ` +
          'falling back to environment variables:',
        configError.message
      );

      tenant = {
        id: 'default',
        accessToken: config.square.accessToken, // ✅ FIX: Use 'accessToken' not 'squareAccessToken'
        locationId: config.square.locationId,
        environment: config.square.environment || 'sandbox',
        timezone: config.server.timezone || 'America/New_York',
        businessName: config.businessName || 'Elite Barbershop'
      };

      logEvent('retell_config_fallback', {
        correlationId,
        agentId: agent_id,
        error: configError.message,
        fallbackTenantId: tenant.id
      });
    }

    // 🔐 CREATE SESSION: Generate a unique call_id and create session for this agent
    // Tool calls during this call will use x-retell-call-id header to access credentials
    const crypto = require('crypto');
    const callId = crypto.randomUUID();

    try {
      sessionStore.createSession(
        callId,
        agent_id,
        {
          squareAccessToken: tenant.accessToken,
          squareLocationId: tenant.locationId,
          squareEnvironment: tenant.environment,
          timezone: tenant.timezone,
          businessName: tenant.businessName
        },
        600
      ); // 10 minute TTL

      console.log(`[SessionStore] 📝 Session created for agent ${agent_id}: ${callId}`);
      logEvent('retell_session_created', {
        correlationId,
        agentId: agent_id,
        callId: callId
      });
    } catch (sessionError) {
      console.error('[SessionStore] ❌ Failed to create session:', sessionError);
      logEvent('retell_session_creation_error', {
        correlationId,
        agentId: agent_id,
        error: sessionError.message
      });
    }

    // For inbound calls, we'll treat it similar to call_started but with the inbound call structure
    // Use the same customer lookup logic as regular calls
    const customerController = require('./customerController');

    // Create a mock request/response to reuse the existing getCustomerInfoByPhone logic
    const mockReq = {
      body: { phone: from_number },
      correlationId: correlationId,
      tenant: tenant, // ✅ PASS TENANT CONTEXT
      callId: callId // ✅ PASS CALL_ID so it can be added to dynamic_variables
    };

    let customerResponse = null;
    const mockRes = {
      status: () => mockRes,
      json: data => {
        customerResponse = data;
        return mockRes;
      }
    };

    // Call the existing getCustomerInfoByPhone function to get exact ElevenLabs format
    await customerController.getCustomerInfoByPhone(mockReq, mockRes);

    // Return the exact same response format as ElevenLabs, including tenant info for business name
    const result = {
      processed: true,
      event: 'call_inbound',
      agentId: agent_id,
      callId: callId, // 🔐 Include call_id so client can send it back in tool calls
      fromNumber: from_number,
      customerResponse: customerResponse,
      tenant: tenant, // Include tenant for business name access
      summary: `Inbound call processed for agent ${agent_id}`
    };

    console.log(
      '🔍 [RETELL DEBUG] Returning result from handleCallInbound:',
      JSON.stringify(result, null, 2)
    );
    return result;
  } catch (error) {
    logEvent('retell_call_inbound_error', {
      correlationId,
      agentId: agent_id,
      error: error.message
    });

    // Return error in same format but with basic info
    return {
      processed: true,
      event: 'call_inbound',
      agentId: agent_id,
      error: error.message,
      customerResponse: {
        success: false,
        type: 'conversation_initiation_client_data',
        dynamic_variables: {
          customer_first_name: '',
          customer_last_name: '',
          customer_full_name: '',
          customer_email: '',
          customer_phone: from_number || '',
          customer_id: '',
          upcoming_bookings_json: '[]',
          booking_history_json: '[]',
          is_returning_customer: false,
          current_datetime_store_timezone: new Date().toLocaleString('en-US', {
            timeZone: 'America/New_York'
          }),
          service_variations_json: '{}',
          staff_with_ids_json: '[]',
          available_services: '',
          available_staff: '',
          caller_id: from_number ? from_number.replace(/\D/g, '').slice(-10) : '',
          initial_message: 'Thank you for calling Elite Barbershop, who am I speaking with today?'
        },
        correlation_id: correlationId
      },
      summary: `Inbound call processed with error for agent ${agent_id}`
    };
  }
}

module.exports = {
  handleRetellWebhook,
  handleCallStarted,
  handleCallAnalyzed,
  handleCallEnded,
  handleCallInbound
};
