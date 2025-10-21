const crypto = require('crypto');

const { logEvent } = require('../../utils/logger');
const sessionStore = require('../../services/sessionStore');
const retellWebhookService = require('../../services/retellWebhookService');
const retellEmailService = require('../../services/retellEmailService');
const agentConfigService = require('../../services/agentConfigService');
const { config } = require('../../config');
const { buildConversationInitiationData } = require('../../services/customerInfoResponseService');
const { buildInboundResponse, buildDefaultDynamicVariables } = require('./inboundResponseBuilder');

function maskNumber(number) {
  if (!number) return 'unknown';
  const value = String(number);
  if (value.length <= 5) return `${value}***`;
  return `${value.substring(0, 5)}***`;
}

function normalizeTenantShape(tenant) {
  if (!tenant) return tenant;
  if (!tenant.squareAccessToken && tenant.accessToken) {
    tenant.squareAccessToken = tenant.accessToken;
  }
  if (!tenant.squareLocationId && tenant.locationId) {
    tenant.squareLocationId = tenant.locationId;
  }
  if (!tenant.squareEnvironment && tenant.environment) {
    tenant.squareEnvironment = tenant.environment;
  }
  return tenant;
}

async function handleCallStarted(payload, context) {
  const { correlationId, tenant: requestTenant } = context;
  const call = payload.call;
  const { call_id, from_number, direction, agent_id } = call;

  logEvent('retell_call_started', {
    correlationId,
    callId: call_id,
    fromNumber: from_number ? `${maskNumber(from_number)}` : 'unknown',
    direction
  });

  let sessionTenant = null;
  let agentConfigTenant = null;

  if (call_id) {
    const session = sessionStore.getSession(call_id);

    if (session?.credentials?.squareAccessToken) {
      sessionTenant = {
        id: session.agentId || requestTenant?.id || 'default',
        squareAccessToken: session.credentials.squareAccessToken,
        squareLocationId: session.credentials.squareLocationId,
        squareEnvironment:
          session.credentials.squareEnvironment ||
          requestTenant?.squareEnvironment ||
          config.square.environment ||
          'sandbox',
        timezone:
          session.credentials.timezone || requestTenant?.timezone || config.server.timezone || 'America/New_York',
        businessName:
          session.credentials.businessName ||
          requestTenant?.businessName ||
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

  const tenant =
    normalizeTenantShape(sessionTenant) ||
    normalizeTenantShape(agentConfigTenant) ||
    normalizeTenantShape(requestTenant) || {
      id: 'default',
      squareAccessToken: config.square.accessToken,
      squareLocationId: config.square.locationId,
      squareEnvironment: config.square.environment || 'sandbox',
      timezone: config.server.timezone || 'America/New_York',
      businessName: config.businessName || 'Elite Barbershop'
    };

  if (!tenant.squareAccessToken) {
    logEvent('retell_call_started_missing_credentials', {
      correlationId,
      callId: call_id,
      tenantId: tenant.id,
      tenantKeys: Object.keys(tenant || {})
    });
  }

  try {
    const customerResponse = await buildConversationInitiationData({
      tenant,
      phoneNumber: from_number,
      correlationId
    });

    return {
      processed: true,
      event: 'call_started',
      callId: call_id,
      customerResponse,
      tenant,
      summary: `Call started processed for ${call_id}`
    };
  } catch (error) {
    logEvent('retell_call_started_error', {
      correlationId,
      callId: call_id,
      error: error.message
    });

    const businessName = tenant?.businessName || 'Elite Barbershop';

    return {
      processed: true,
      event: 'call_started',
      callId: call_id,
      tenant,
      error: error.message,
      customerResponse: {
        success: false,
        type: 'conversation_initiation_client_data',
        dynamic_variables: buildDefaultDynamicVariables({ businessName, fromNumber: from_number }),
        correlation_id: correlationId
      },
      summary: `Call started processed with error for ${call_id}`
    };
  }
}

async function handleCallAnalyzed(payload, context) {
  const { correlationId } = context;
  const call = payload.call;
  const { call_id, from_number, transcript, call_analysis } = call;

  logEvent('retell_call_analyzed', {
    correlationId,
    callId: call_id,
    fromNumber: from_number ? `${maskNumber(from_number)}` : 'unknown',
    hasTranscript: !!transcript,
    hasAnalysis: !!call_analysis
  });

  try {
    let emailSent = false;
    try {
      const emailResult = await retellEmailService.sendRetellPostCallEmail({ call }, correlationId);
      emailSent = true;
      logEvent('retell_email_sent', {
        correlationId,
        callId: call_id,
        emailResult
      });
    } catch (emailError) {
      logEvent('retell_email_failed', {
        correlationId,
        callId: call_id,
        error: emailError.message
      });
    }

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
      summary: result.summary || `Call analyzed processed for ${call_id}`,
      metrics: {
        emailSent,
        hasTranscript: !!transcript,
        hasAnalysis: !!call_analysis
      }
    };
  } catch (error) {
    logEvent('retell_call_analyzed_error', {
      correlationId,
      callId: call_id,
      error: error.message
    });

    return {
      processed: false,
      event: 'call_analyzed',
      callId: call_id,
      summary: `Call analyzed failed for ${call_id}`,
      error: error.message
    };
  }
}

async function handleCallEnded(payload, context) {
  const { correlationId } = context;
  const call = payload.call;
  const { call_id, from_number, direction, end_timestamp } = call;

  logEvent('retell_call_ended', {
    correlationId,
    callId: call_id,
    fromNumber: from_number ? `${maskNumber(from_number)}` : 'unknown',
    direction,
    endTimestamp: end_timestamp
  });

  try {
    const destroyed = sessionStore.destroySession(call_id);

    if (destroyed) {
      logEvent('retell_session_destroyed', {
        correlationId,
        callId: call_id
      });
    }

    return {
      processed: true,
      event: 'call_ended',
      callId: call_id,
      summary: `Call ended acknowledged for ${call_id}`,
      metrics: {
        sessionDestroyed: destroyed
      }
    };
  } catch (error) {
    logEvent('retell_call_ended_error', {
      correlationId,
      callId: call_id,
      error: error.message
    });

    return {
      processed: true,
      event: 'call_ended',
      callId: call_id,
      summary: `Call ended acknowledged with error for ${call_id}`,
      error: error.message
    };
  }
}

async function handleCallInbound(payload, context) {
  const { correlationId } = context;
  const callInbound = payload.call_inbound;
  const { agent_id, from_number, to_number } = callInbound;

  logEvent('retell_call_inbound', {
    correlationId,
    agentId: agent_id,
    fromNumber: from_number ? `${maskNumber(from_number)}` : 'unknown',
    toNumber: to_number ? `${maskNumber(to_number)}` : 'unknown'
  });

  try {
    let tenant;
    try {
      const agentConfig = agentConfigService.getAgentConfig(agent_id);

      tenant = {
        id: agentConfig.agentId || agent_id,
        accessToken: agentConfig.squareAccessToken,
        locationId: agentConfig.squareLocationId,
        applicationId: agentConfig.squareApplicationId,
        environment: agentConfig.squareEnvironment,
        timezone: agentConfig.timezone,
        staffEmail: agentConfig.staffEmail,
        businessName: agentConfig.businessName
      };
    } catch (configError) {
      logEvent('retell_config_fallback', {
        correlationId,
        agentId: agent_id,
        error: configError.message,
        fallbackTenantId: 'default'
      });

      tenant = {
        id: 'default',
        accessToken: config.square.accessToken,
        locationId: config.square.locationId,
        environment: config.square.environment || 'sandbox',
        timezone: config.server.timezone || 'America/New_York',
        businessName: config.businessName || 'Elite Barbershop'
      };
    }

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
      );

      logEvent('retell_session_created', {
        correlationId,
        agentId: agent_id,
        callId
      });
    } catch (sessionError) {
      logEvent('retell_session_creation_error', {
        correlationId,
        agentId: agent_id,
        error: sessionError.message
      });
    }

    let customerResponse = null;
    try {
      customerResponse = await buildConversationInitiationData({
        tenant,
        phoneNumber: from_number,
        correlationId
      });
    } catch (customerLookupError) {
      logEvent('retell_customer_lookup_error', {
        correlationId,
        agentId: agent_id,
        error: customerLookupError.message || String(customerLookupError)
      });
    }

    const inboundResponse = buildInboundResponse({
      customerResponse,
      businessName: tenant.businessName || 'Elite Barbershop',
      fromNumber: from_number,
      callId,
      correlationId
    });

    return {
      processed: true,
      event: 'call_inbound',
      callId,
      tenant,
      customerResponse,
      response: inboundResponse,
      summary: `Inbound call processed for agent ${agent_id}`
    };
  } catch (error) {
    logEvent('retell_call_inbound_error', {
      correlationId,
      agentId: callInbound?.agent_id,
      error: error.message
    });

    const fallbackCallId = crypto.randomUUID();
    const fallbackResponse = buildInboundResponse({
      customerResponse: null,
      businessName: config.businessName || 'Elite Barbershop',
      fromNumber: callInbound?.from_number || '',
      callId: fallbackCallId,
      correlationId
    });

    return {
      processed: true,
      event: 'call_inbound',
      callId: fallbackCallId,
      error: error.message,
      response: fallbackResponse,
      summary: `Inbound call processed with error for agent ${callInbound?.agent_id}`
    };
  }
}

module.exports = {
  handleCallStarted,
  handleCallAnalyzed,
  handleCallEnded,
  handleCallInbound
};
