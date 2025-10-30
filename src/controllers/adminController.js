/**
 * Admin Controller
 * Protected endpoints for administrative operations
 */

const { logger } = require('../utils/logger');
const { query } = require('../services/database');
const onboardingService = require('../services/onboardingService');
const adminPhoneNumberController = require('./adminPhoneNumberController');

/**
 * Complete agent onboarding
 * POST /api/admin/complete-onboarding
 *
 * Takes OAuth callback response and automatically:
 * 1. Generates secure bearer token
 * 2. Updates Azure App Service AGENT_CONFIGS
 * 3. Restarts app service
 * 4. Returns credentials for Retell configuration
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function completeOnboarding(req, res) {
  const correlationId = req.correlationId;

  try {
    const {
      tenantId,
      agentId,
      businessName,
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      merchantId,
      defaultLocationId,
      supportsSellerLevelWrites,
      timezone,
      squareEnvironment,
      voicePreferences,
      submittedBy,
      configuration
    } = req.body || {};

    if (!tenantId || !agentId || !accessToken || !merchantId || !defaultLocationId) {
      return res.status(400).json({
        success: false,
        error: 'missing_required_fields',
        message: 'tenantId, agentId, accessToken, merchantId, and defaultLocationId are required',
        correlationId
      });
    }

    const onboardingResult = await onboardingService.confirmSquareAuthorization({
      tenantId,
      retellAgentId: agentId,
      tokens: {
        accessToken,
        refreshToken,
        scope,
        expiresAt,
        merchantId,
        environment: squareEnvironment || 'production'
      },
      metadata: {
        merchantId,
        defaultLocationId,
        displayName: businessName,
        supportsSellerLevelWrites,
        environment: squareEnvironment || 'production',
        timezone
      },
      voicePreferences,
      submittedBy,
      configuration
    });

    logger.info('Onboarding persisted via admin endpoint', {
      agentId,
      tenantId,
      correlationId
    });

    return res.json({
      success: true,
      agent: {
        agentId,
        bearerToken: onboardingResult.bearerToken,
        tenantId,
        defaultLocationId,
        supportsSellerLevelWrites
      },
      pendingQa: onboardingResult.pendingQa
    });
  } catch (error) {
    logger.error('Onboarding failed', {
      message: error.message,
      correlationId
    });

    return res.status(500).json({
      success: false,
      error: 'onboarding_failed',
      message: error.message,
      correlationId
    });
  }
}

/**
 * List all configured agents
 * GET /api/admin/agents
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function listAgents(req, res) {
  try {
    const { rows } = await query(
      `
        SELECT
          ra.retell_agent_id,
          ra.display_name,
          ra.status,
          ra.qa_status,
          t.id AS tenant_id,
          t.business_name,
          t.slug,
          sc.square_environment,
          sc.square_merchant_id,
          sc.supports_seller_level_writes,
          sc.default_location_id,
          sc.square_token_expires_at
        FROM retell_agents ra
        INNER JOIN tenants t ON t.id = ra.tenant_id
        LEFT JOIN square_credentials sc ON sc.retell_agent_uuid = ra.id
        ORDER BY t.business_name ASC
      `
    );

    return res.json({
      success: true,
      agents: rows,
      count: rows.length
    });
  } catch (error) {
    logger.error('Failed to list agents', {
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'list_failed',
      message: error.message
    });
  }
}

async function listPendingQaAgents(req, res) {
  try {
    const { rows } = await query(
      `
        SELECT
          p.id,
          p.qa_status,
          p.configuration,
          p.created_at,
          p.updated_at,
          t.business_name,
          t.slug,
          ra.retell_agent_id,
          ra.display_name,
          ra.status
        FROM pending_qa_agents p
        INNER JOIN tenants t ON t.id = p.tenant_id
        LEFT JOIN retell_agents ra ON ra.id = p.retell_agent_uuid
        ORDER BY p.created_at ASC
      `
    );

    return res.json({
      success: true,
      pending: rows,
      count: rows.length
    });
  } catch (error) {
    logger.error('Failed to list pending QA agents', {
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'list_failed',
      message: error.message
    });
  }
}

async function listSupportTickets(req, res) {
  try {
    const { status, severity, tenantId, limit } = req.query || {};
    const conditions = [];
    const values = [];

    if (tenantId) {
      conditions.push(`st.tenant_id = $${values.length + 1}`);
      values.push(tenantId);
    }

    if (status) {
      conditions.push(`st.status = $${values.length + 1}`);
      values.push(String(status).toLowerCase());
    }

    if (severity) {
      conditions.push(`st.severity = $${values.length + 1}`);
      values.push(String(severity).toLowerCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitValue = Math.min(parseInt(limit, 10) || 50, 200);
    values.push(limitValue);

    const { rows } = await query(
      `
        SELECT
          st.*,
          t.business_name,
          t.slug AS tenant_slug
        FROM support_tickets st
        INNER JOIN tenants t ON t.id = st.tenant_id
        ${whereClause}
        ORDER BY st.created_at DESC
        LIMIT $${values.length}
      `,
      values
    );

    return res.json({
      success: true,
      tickets: rows,
      count: rows.length
    });
  } catch (error) {
    logger.error('Failed to list support tickets', {
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'list_failed',
      message: error.message
    });
  }
}

module.exports = {
  completeOnboarding,
  listAgents,
  listPendingQaAgents,
  listSupportTickets,
  listPhoneNumberAssignments: adminPhoneNumberController.listAll,
  updatePhoneNumberAssignment: adminPhoneNumberController.updateAssignment
};
