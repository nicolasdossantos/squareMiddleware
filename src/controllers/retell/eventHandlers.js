const crypto = require('crypto');

const { logEvent, logger } = require('../../utils/logger');
const sessionStore = require('../../services/sessionStore');
const retellWebhookService = require('../../services/retellWebhookService');
const retellEmailService = require('../../services/retellEmailService');
const agentConfigService = require('../../services/agentConfigService');
const customerContextService = require('../../services/customerContextService');
const tenantService = require('../../services/tenantService');
const { config } = require('../../config');
const { buildConversationInitiationData } = require('../../services/customerInfoResponseService');
const { buildInboundResponse, buildDefaultDynamicVariables } = require('./inboundResponseBuilder');
const { validate: uuidValidate } = require('uuid');

function buildMissingAgentConfigResponse(agentId, correlationId, callId, source) {
  logEvent('retell_agent_config_missing', {
    correlationId,
    callId,
    agentId,
    source
  });

  return {
    processed: false,
    event: source,
    callId,
    summary: `Agent configuration missing for ${agentId}`,
    response: {
      status: 401,
      body: {
        success: false,
        error: 'Agent configuration not found',
        agentId,
        correlationId,
        source
      }
    }
  };
}

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

function isUuid(value) {
  return typeof value === 'string' && uuidValidate(value);
}

async function loadTenantFromAgent(agentId) {
  if (!agentId) {
    return null;
  }

  try {
    const context = await tenantService.getAgentContextByRetellId(agentId);
    if (!context || !context.tenantId) {
      return null;
    }

    return normalizeTenantShape({
      id: context.tenantId,
      tenantId: context.tenantId,
      agentId: context.agentId,
      squareAccessToken: context.squareAccessToken,
      accessToken: context.squareAccessToken,
      squareRefreshToken: context.squareRefreshToken,
      squareTokenExpiresAt: context.squareTokenExpiresAt,
      squareLocationId: context.squareLocationId || context.defaultLocationId,
      locationId: context.defaultLocationId || context.squareLocationId,
      defaultLocationId: context.defaultLocationId || context.squareLocationId,
      squareEnvironment: context.squareEnvironment || config.square.environment || 'sandbox',
      environment: context.squareEnvironment || config.square.environment || 'sandbox',
      timezone: context.timezone || config.server.timezone || 'America/New_York',
      businessName: context.businessName,
      supportsSellerLevelWrites: Boolean(context.supportsSellerLevelWrites),
      squareMerchantId: context.squareMerchantId
    });
  } catch (error) {
    logger.warn('retell_agent_context_lookup_failed', {
      agentId,
      message: error.message
    });
    return null;
  }
}

function normalizeCallAnalysis(analysis) {
  if (!analysis) {
    return {};
  }

  if (Array.isArray(analysis)) {
    return analysis.reduce((acc, item) => {
      if (item?.name) {
        acc[item.name] = item.value;
      }
      return acc;
    }, {});
  }

  if (typeof analysis === 'string') {
    try {
      return JSON.parse(analysis);
    } catch (error) {
      logger.warn('retell_call_analysis_parse_failed', {
        error: error.message
      });
      return { raw_payload: analysis };
    }
  }

  return analysis;
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

  const session = call_id ? sessionStore.getSession(call_id) : null;
  let sessionTenant = null;
  let agentConfigTenant = null;

  if (session?.credentials?.squareAccessToken) {
    sessionTenant = normalizeTenantShape({
      id: session.tenantId || session.metadata?.tenantId || requestTenant?.id || session.agentId || 'default',
      tenantId: session.tenantId || session.metadata?.tenantId || null,
      agentId: session.agentId,
      squareAccessToken: session.credentials.squareAccessToken,
      squareLocationId: session.credentials.squareLocationId,
      squareEnvironment:
        session.credentials.squareEnvironment ||
        requestTenant?.squareEnvironment ||
        config.square.environment ||
        'sandbox',
      timezone:
        session.credentials.timezone ||
        requestTenant?.timezone ||
        config.server.timezone ||
        'America/New_York',
      businessName:
        session.credentials.businessName ||
        requestTenant?.businessName ||
        config.businessName ||
        'Elite Barbershop'
    });

    logEvent('retell_call_started_session_match', {
      correlationId,
      callId: call_id,
      tenantId: sessionTenant.id
    });
  } else if (call_id) {
    logEvent('retell_call_started_session_missing', {
      correlationId,
      callId: call_id
    });
  }

  if (!sessionTenant && !agent_id) {
    return buildMissingAgentConfigResponse('unknown', correlationId, call_id, 'call_started');
  }

  if (!sessionTenant && agent_id) {
    try {
      const agentConfig = agentConfigService.getAgentConfig(agent_id);

      agentConfigTenant = normalizeTenantShape({
        id: agentConfig.tenantId || agentConfig.agentId || agent_id,
        tenantId: agentConfig.tenantId || null,
        agentId: agentConfig.agentId,
        accessToken: agentConfig.squareAccessToken,
        squareAccessToken: agentConfig.squareAccessToken,
        squareLocationId: agentConfig.squareLocationId,
        locationId: agentConfig.squareLocationId,
        squareEnvironment: agentConfig.squareEnvironment,
        environment: agentConfig.squareEnvironment,
        timezone: agentConfig.timezone,
        businessName: agentConfig.businessName,
        supportsSellerLevelWrites: agentConfig.supportsSellerLevelWrites,
        squareMerchantId: agentConfig.squareMerchantId
      });

      logEvent('retell_call_started_agent_config', {
        correlationId,
        callId: call_id,
        agentId: agentConfigTenant.id
      });
    } catch (configError) {
      return buildMissingAgentConfigResponse(agent_id, correlationId, call_id, 'call_started');
    }
  }

  const normalizedRequestTenant = requestTenant ? normalizeTenantShape({ ...requestTenant }) : null;
  const dbTenant = await loadTenantFromAgent(agent_id || session?.agentId || sessionTenant?.agentId);

  const candidateTenants = [dbTenant, sessionTenant, normalizedRequestTenant, agentConfigTenant].filter(
    Boolean
  );
  let tenant =
    candidateTenants.find(t => t && t.squareAccessToken) ||
    (candidateTenants.length > 0 ? candidateTenants[0] : null);

  if (dbTenant && isUuid(dbTenant.id)) {
    tenant = dbTenant;
  }

  if (tenant) {
    if (tenant.tenantId && isUuid(tenant.tenantId) && (!tenant.id || !isUuid(tenant.id))) {
      tenant.id = tenant.tenantId;
    }

    if (tenant.id && isUuid(tenant.id) && !tenant.tenantId) {
      tenant.tenantId = tenant.id;
    }

    if (tenant.squareAccessToken && !tenant.accessToken) {
      tenant.accessToken = tenant.squareAccessToken;
    }
  }

  if (tenant?.id && !isUuid(tenant.id)) {
    logger.warn('retell_call_started_non_uuid_tenant', {
      correlationId,
      callId: call_id,
      tenantId: tenant.id,
      agentId: agent_id
    });
  }

  if (!tenant?.squareAccessToken) {
    return buildMissingAgentConfigResponse(agent_id || 'unknown', correlationId, call_id, 'call_started');
  }

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
  const { correlationId, tenant: requestTenant } = context;
  const call = payload.call;
  const { call_id, from_number, transcript, call_analysis } = call;
  const normalizedAnalysis = normalizeCallAnalysis(call_analysis);
  call.call_analysis = normalizedAnalysis;

  logger.info('retell_call_analyzed_start', {
    correlationId,
    callId: call_id,
    hasAnalysis: Boolean(call_analysis),
    fromNumber: from_number ? `${maskNumber(from_number)}` : 'unknown'
  });
  logEvent('retell_call_analyzed', {
    correlationId,
    callId: call_id,
    fromNumber: from_number ? `${maskNumber(from_number)}` : 'unknown',
    hasTranscript: !!transcript,
    hasAnalysis: !!call_analysis
  });

  const session = sessionStore.getSession(call_id);
  const normalizedRequestTenant = requestTenant ? normalizeTenantShape({ ...requestTenant }) : null;

  const sessionTenant = session?.credentials?.squareAccessToken
    ? normalizeTenantShape({
        id:
          session.tenantId ||
          session.metadata?.tenantId ||
          normalizedRequestTenant?.id ||
          session.agentId ||
          'default',
        tenantId: session.tenantId || session.metadata?.tenantId || null,
        agentId: session.agentId,
        squareAccessToken: session.credentials.squareAccessToken,
        squareLocationId: session.credentials.squareLocationId,
        squareEnvironment:
          session.credentials.squareEnvironment ||
          normalizedRequestTenant?.squareEnvironment ||
          config.square.environment ||
          'sandbox',
        timezone:
          session.credentials.timezone ||
          normalizedRequestTenant?.timezone ||
          config.server.timezone ||
          'America/New_York',
        businessName:
          session.credentials.businessName ||
          normalizedRequestTenant?.businessName ||
          config.businessName ||
          'Elite Barbershop'
      })
    : null;

  let agentConfigTenant = null;
  if (call.agent_id) {
    try {
      const agentConfig = agentConfigService.getAgentConfig(call.agent_id);
      agentConfigTenant = normalizeTenantShape({
        id: agentConfig.tenantId || agentConfig.agentId || call.agent_id,
        tenantId: agentConfig.tenantId || null,
        agentId: agentConfig.agentId,
        squareAccessToken: agentConfig.squareAccessToken,
        squareLocationId: agentConfig.squareLocationId,
        squareEnvironment: agentConfig.squareEnvironment,
        timezone: agentConfig.timezone,
        businessName: agentConfig.businessName,
        supportsSellerLevelWrites: agentConfig.supportsSellerLevelWrites,
        squareMerchantId: agentConfig.squareMerchantId
      });
    } catch (agentError) {
      logger.warn('retell_call_analyzed_agent_config_missing', {
        correlationId,
        callId: call_id,
        agentId: call.agent_id,
        error: agentError.message
      });
    }
  }

  const dbTenant = await loadTenantFromAgent(call.agent_id || session?.agentId || sessionTenant?.agentId);
  const candidateTenants = [dbTenant, sessionTenant, normalizedRequestTenant, agentConfigTenant].filter(
    Boolean
  );

  let tenant =
    candidateTenants.find(t => t.squareAccessToken) ||
    candidateTenants[0] ||
    normalizeTenantShape({
      id: 'default',
      squareAccessToken: config.square.accessToken,
      squareLocationId: config.square.locationId,
      squareEnvironment: config.square.environment || 'sandbox',
      timezone: config.server.timezone || 'America/New_York',
      businessName: config.businessName || 'Elite Barbershop'
    });

  if (dbTenant && isUuid(dbTenant.id)) {
    tenant = dbTenant;
  }

  if (tenant) {
    if (tenant.tenantId && isUuid(tenant.tenantId) && (!tenant.id || !isUuid(tenant.id))) {
      tenant.id = tenant.tenantId;
    }

    if (tenant.id && isUuid(tenant.id) && !tenant.tenantId) {
      tenant.tenantId = tenant.id;
    }

    if (tenant.squareAccessToken && !tenant.accessToken) {
      tenant.accessToken = tenant.squareAccessToken;
    }
  }

  if (tenant?.id && !isUuid(tenant.id)) {
    logger.warn('retell_call_analyzed_non_uuid_tenant', {
      correlationId,
      callId: call_id,
      tenantId: tenant.id,
      agentId: call.agent_id
    });
  }

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
      analysis: normalizedAnalysis,
      correlationId
    });

    let contextPersistence = null;
    try {
      contextPersistence = await customerContextService.saveCallAnalysis({
        tenant,
        call,
        correlationId
      });

      logger.info('retell_call_analyzed_save_attempt', {
        correlationId,
        callId: call_id,
        tenantId: tenant.id
      });
      if (call_id && contextPersistence?.profile?.id) {
        const updatedSession = sessionStore.updateSession(call_id, {
          customerProfileId: contextPersistence.profile.id,
          contextPersistedAt: new Date().toISOString(),
          tenantId: tenant.id
        });

        if (updatedSession) {
          logEvent('retell_call_analyzed_context_session_update', {
            correlationId,
            callId: call_id,
            metadataKeys: Object.keys(updatedSession.metadata || {})
          });
        }
      }

      if (contextPersistence) {
        logEvent('retell_call_analyzed_context_persisted', {
          correlationId,
          callId: call_id,
          tenantId: tenant.id,
          profileId: contextPersistence.profile?.id || null,
          contextUpserts: contextPersistence.contextUpserted || 0,
          issuesCreated: contextPersistence.issuesCreated || 0,
          issuesUpdated: contextPersistence.issuesUpdated || 0
        });

        logger.info('retell_call_analyzed_save_success', {
          correlationId,
          callId: call_id,
          tenantId: tenant.id,
          profileId: contextPersistence.profile?.id || null,
          contextUpserts: contextPersistence.contextUpserted || 0,
          issuesCreated: contextPersistence.issuesCreated || 0,
          issuesUpdated: contextPersistence.issuesUpdated || 0
        });
      }
    } catch (contextError) {
      logEvent('retell_call_analyzed_context_error', {
        correlationId,
        callId: call_id,
        error: contextError.message
      });

      logger.error('retell_call_analyzed_save_failure', {
        correlationId,
        callId: call_id,
        error: contextError.stack || contextError.message
      });
    }

    return {
      processed: true,
      event: 'call_analyzed',
      callId: call_id,
      summary: result.summary || `Call analyzed processed for ${call_id}`,
      metrics: {
        emailSent,
        hasTranscript: !!transcript,
        hasAnalysis: !!call_analysis,
        contextUpserts: contextPersistence?.contextUpserted || 0,
        issuesCreated: contextPersistence?.issuesCreated || 0
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
    if (!agent_id) {
      return buildMissingAgentConfigResponse('unknown', correlationId, null, 'call_inbound');
    }

    let tenant = await loadTenantFromAgent(agent_id);

    if (!tenant || !tenant.squareAccessToken) {
      try {
        const agentConfig = agentConfigService.getAgentConfig(agent_id);
        const supportsSellerLevelWrites =
          typeof agentConfig.supportsSellerLevelWrites === 'boolean'
            ? agentConfig.supportsSellerLevelWrites
            : true;

        tenant = normalizeTenantShape({
          id: agentConfig.tenantId || agentConfig.agentId || agent_id,
          tenantId: agentConfig.tenantId || null,
          accessToken: agentConfig.squareAccessToken,
          squareAccessToken: agentConfig.squareAccessToken,
          locationId: agentConfig.defaultLocationId || agentConfig.squareLocationId,
          squareLocationId: agentConfig.squareLocationId,
          applicationId: agentConfig.squareApplicationId,
          environment: agentConfig.squareEnvironment,
          squareEnvironment: agentConfig.squareEnvironment,
          timezone: agentConfig.timezone,
          staffEmail: agentConfig.staffEmail,
          businessName: agentConfig.businessName,
          squareMerchantId: agentConfig.squareMerchantId,
          merchantId: agentConfig.squareMerchantId,
          supportsSellerLevelWrites,
          squareScopes: agentConfig.squareScopes,
          squareRefreshToken: agentConfig.squareRefreshToken,
          squareTokenExpiresAt: agentConfig.squareTokenExpiresAt,
          defaultLocationId: agentConfig.defaultLocationId || agentConfig.squareLocationId
        });
      } catch (configError) {
        return buildMissingAgentConfigResponse(agent_id, correlationId, null, 'call_inbound');
      }
    }

    if (tenant.tenantId && (!tenant.id || !isUuid(tenant.id))) {
      tenant.id = tenant.tenantId;
    }

    if (tenant.id && !tenant.tenantId && isUuid(tenant.id)) {
      tenant.tenantId = tenant.id;
    }

    if (tenant.squareAccessToken && !tenant.accessToken) {
      tenant.accessToken = tenant.squareAccessToken;
    }

    if (!tenant?.squareAccessToken) {
      return buildMissingAgentConfigResponse(agent_id, correlationId, null, 'call_inbound');
    }

    const callId = crypto.randomUUID();

    try {
      sessionStore.createSession(
        callId,
        agent_id,
        {
          squareAccessToken: tenant.squareAccessToken,
          squareLocationId: tenant.locationId,
          squareEnvironment: tenant.environment,
          timezone: tenant.timezone,
          businessName: tenant.businessName,
          squareMerchantId: tenant.squareMerchantId,
          supportsSellerLevelWrites: tenant.supportsSellerLevelWrites,
          squareRefreshToken: tenant.squareRefreshToken,
          squareTokenExpiresAt: tenant.squareTokenExpiresAt,
          squareScopes: tenant.squareScopes,
          defaultLocationId: tenant.defaultLocationId
        },
        600,
        {
          fromNumber: from_number,
          tenantId: tenant.id
        }
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

    if (from_number) {
      try {
        const storedContext = await customerContextService.getCustomerContext({
          tenantId: tenant.id,
          phoneNumber: from_number,
          correlationId
        });

        if (storedContext) {
          const dynamicVariables =
            customerResponse?.dynamic_variables ||
            customerResponse?.customer?.dynamic_variables ||
            (customerResponse
              ? (customerResponse.dynamic_variables = {})
              : (customerResponse = {
                  success: false,
                  type: 'conversation_initiation_client_data',
                  dynamic_variables: {}
                }));

          if (storedContext.dynamicVariables && dynamicVariables) {
            Object.assign(dynamicVariables, storedContext.dynamicVariables);
          }

          if (dynamicVariables && storedContext.openIssues) {
            dynamicVariables.open_issues_json = JSON.stringify(storedContext.openIssues);
            dynamicVariables.has_open_issues = storedContext.openIssues.length > 0 ? 'true' : 'false';
          }

          const updatedSession = sessionStore.updateSession(callId, {
            customerProfileId: storedContext?.profile?.id || null,
            normalizedPhone: storedContext?.normalizedPhone || null,
            lastContextSync: new Date().toISOString(),
            tenantId: tenant.id
          });

          logEvent('retell_call_inbound_context_applied', {
            correlationId,
            agentId: agent_id,
            callId,
            profileId: storedContext?.profile?.id || null,
            dynamicKeys: Object.keys(storedContext.dynamicVariables || {}),
            openIssues: storedContext.openIssues?.length || 0
          });

          if (updatedSession) {
            logEvent('retell_call_inbound_session_metadata_updated', {
              correlationId,
              agentId: agent_id,
              callId,
              metadataKeys: Object.keys(updatedSession.metadata || {})
            });
          }
        }
      } catch (contextError) {
        logEvent('retell_call_inbound_context_error', {
          correlationId,
          agentId: agent_id,
          callId,
          error: contextError.message
        });
      }
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
