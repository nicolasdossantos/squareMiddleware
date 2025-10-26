/**
 * Admin Controller
 * Protected endpoints for administrative operations
 */

const azureConfigService = require('../services/azureConfigService');
const { logger } = require('../utils/logger');

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
      staffEmail
    } = req.body;

    // Validate required fields
    const requiredFields = {
      agentId,
      businessName,
      accessToken,
      merchantId,
      defaultLocationId,
      squareEnvironment
    };

    const missing = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'missing_required_fields',
        message: `Missing required fields: ${missing.join(', ')}`,
        correlationId
      });
    }

    logger.info('Starting automated onboarding', {
      agentId,
      businessName,
      environment: squareEnvironment,
      correlationId
    });

    // Add agent configuration
    const result = await azureConfigService.addAgentConfig({
      agentId,
      businessName,
      squareAccessToken: accessToken,
      squareRefreshToken: refreshToken || null,
      squareTokenExpiresAt: expiresAt || null,
      squareScopes: Array.isArray(scope) ? scope : scope?.split(' ') || [],
      squareMerchantId: merchantId,
      supportsSellerLevelWrites: supportsSellerLevelWrites === true,
      squareLocationId: defaultLocationId,
      defaultLocationId,
      squareApplicationId: process.env.SQUARE_APPLICATION_ID,
      staffEmail: staffEmail || null,
      timezone: timezone || 'America/New_York',
      squareEnvironment
    });

    logger.info('Onboarding completed successfully', {
      agentId,
      correlationId
    });

    // Return credentials for Retell configuration
    return res.json({
      success: true,
      message: 'Agent onboarded successfully. App service is restarting.',
      agent: {
        agentId: result.agentId,
        bearerToken: result.bearerToken,
        businessName,
        environment: squareEnvironment,
        supportsSellerLevelWrites,
        merchantId,
        defaultLocationId,
        timezone
      },
      retellConfiguration: {
        instructions: [
          'Use this bearerToken for Retell Custom LLM authentication',
          'Configure webhook URL with X-Agent-ID header',
          'Test with a sample call to verify integration'
        ],
        webhookUrl: `${process.env.PUBLIC_URL || 'https://your-api.azurewebsites.net'}/api/webhooks/retell`,
        headers: {
          'X-Agent-ID': result.agentId,
          'Content-Type': 'application/json'
        },
        authentication: {
          type: 'Bearer Token',
          token: result.bearerToken
        }
      },
      nextSteps: [
        'App service is restarting (may take 30-60 seconds)',
        'Configure Retell agent with the bearerToken above',
        'Set webhook URL in Retell dashboard',
        'Test the integration with a sample call'
      ]
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
    const resourceGroupName = process.env.AZURE_RESOURCE_GROUP;
    const appServiceName = process.env.AZURE_APP_SERVICE_NAME;

    if (!resourceGroupName || !appServiceName) {
      return res.status(500).json({
        success: false,
        error: 'config_error',
        message: 'Azure configuration not set'
      });
    }

    const agents = await azureConfigService.getCurrentAgentConfigs(resourceGroupName, appServiceName);

    // Return safe subset (no tokens)
    const safeAgents = agents.map(agent => ({
      agentId: agent.agentId,
      businessName: agent.businessName,
      squareEnvironment: agent.squareEnvironment,
      timezone: agent.timezone,
      squareMerchantId: agent.squareMerchantId,
      supportsSellerLevelWrites: agent.supportsSellerLevelWrites,
      defaultLocationId: agent.defaultLocationId,
      staffEmail: agent.staffEmail,
      hasRefreshToken: Boolean(agent.squareRefreshToken),
      tokenExpiresAt: agent.squareTokenExpiresAt
    }));

    return res.json({
      success: true,
      agents: safeAgents,
      count: safeAgents.length
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

module.exports = {
  completeOnboarding,
  listAgents
};
