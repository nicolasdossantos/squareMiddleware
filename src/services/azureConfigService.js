/**
 * Azure Configuration Service
 * Manages Azure App Service configuration programmatically
 */

const { DefaultAzureCredential } = require('@azure/identity');
const { WebSiteManagementClient } = require('@azure/arm-appservice');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

/**
 * Get Azure App Service configuration client
 * @returns {WebSiteManagementClient}
 */
function getAppServiceClient() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

  if (!subscriptionId) {
    throw new Error('AZURE_SUBSCRIPTION_ID environment variable is required');
  }

  const credential = new DefaultAzureCredential();
  return new WebSiteManagementClient(credential, subscriptionId);
}

/**
 * Generate a secure bearer token for new agent
 * @returns {string}
 */
function generateBearerToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get current AGENT_CONFIGS from Azure App Service
 * @param {string} resourceGroupName
 * @param {string} appServiceName
 * @returns {Promise<Array>}
 */
async function getCurrentAgentConfigs(resourceGroupName, appServiceName) {
  try {
    const client = getAppServiceClient();

    logger.info('Fetching current App Service configuration', {
      resourceGroup: resourceGroupName,
      appService: appServiceName
    });

    const settings = await client.webApps.listApplicationSettings(resourceGroupName, appServiceName);

    const agentConfigsJson = settings.properties?.AGENT_CONFIGS;

    if (!agentConfigsJson) {
      logger.warn('AGENT_CONFIGS not found in App Service settings');
      return [];
    }

    return JSON.parse(agentConfigsJson);
  } catch (error) {
    logger.error('Failed to fetch current agent configs', {
      message: error.message,
      code: error.code
    });
    throw error;
  }
}

/**
 * Update AGENT_CONFIGS in Azure App Service
 * @param {string} resourceGroupName
 * @param {string} appServiceName
 * @param {Array} agentConfigs
 * @returns {Promise<void>}
 */
async function updateAgentConfigs(resourceGroupName, appServiceName, agentConfigs) {
  try {
    const client = getAppServiceClient();

    logger.info('Updating AGENT_CONFIGS in App Service', {
      resourceGroup: resourceGroupName,
      appService: appServiceName,
      agentCount: agentConfigs.length
    });

    // Get current settings
    const currentSettings = await client.webApps.listApplicationSettings(resourceGroupName, appServiceName);

    // Update AGENT_CONFIGS
    const updatedSettings = {
      ...currentSettings.properties,
      AGENT_CONFIGS: JSON.stringify(agentConfigs)
    };

    // Apply updated settings
    await client.webApps.updateApplicationSettings(resourceGroupName, appServiceName, {
      properties: updatedSettings
    });

    logger.info('Successfully updated AGENT_CONFIGS', {
      resourceGroup: resourceGroupName,
      appService: appServiceName
    });
  } catch (error) {
    logger.error('Failed to update agent configs', {
      message: error.message,
      code: error.code
    });
    throw error;
  }
}

/**
 * Restart Azure App Service
 * @param {string} resourceGroupName
 * @param {string} appServiceName
 * @returns {Promise<void>}
 */
async function restartAppService(resourceGroupName, appServiceName) {
  try {
    const client = getAppServiceClient();

    logger.info('Restarting App Service', {
      resourceGroup: resourceGroupName,
      appService: appServiceName
    });

    await client.webApps.restart(resourceGroupName, appServiceName);

    logger.info('Successfully restarted App Service', {
      resourceGroup: resourceGroupName,
      appService: appServiceName
    });
  } catch (error) {
    logger.error('Failed to restart App Service', {
      message: error.message,
      code: error.code
    });
    throw error;
  }
}

/**
 * Add new agent to AGENT_CONFIGS and restart app
 * @param {object} params
 * @param {string} params.agentId
 * @param {string} params.businessName
 * @param {string} params.squareAccessToken
 * @param {string} params.squareRefreshToken
 * @param {string} params.squareTokenExpiresAt
 * @param {Array<string>} params.squareScopes
 * @param {string} params.squareMerchantId
 * @param {boolean} params.supportsSellerLevelWrites
 * @param {string} params.squareLocationId
 * @param {string} params.defaultLocationId
 * @param {string} params.squareApplicationId
 * @param {string} params.staffEmail
 * @param {string} params.timezone
 * @param {string} params.squareEnvironment
 * @returns {Promise<{success: boolean, agentId: string, bearerToken: string}>}
 */
async function addAgentConfig(params) {
  const resourceGroupName = process.env.AZURE_RESOURCE_GROUP;
  const appServiceName = process.env.AZURE_APP_SERVICE_NAME;

  if (!resourceGroupName || !appServiceName) {
    throw new Error('AZURE_RESOURCE_GROUP and AZURE_APP_SERVICE_NAME environment variables are required');
  }

  try {
    // Get current configs
    const currentConfigs = await getCurrentAgentConfigs(resourceGroupName, appServiceName);

    // Check if agent already exists
    const existingAgent = currentConfigs.find(agent => agent.agentId === params.agentId);
    if (existingAgent) {
      throw new Error(`Agent ${params.agentId} already exists in configuration`);
    }

    // Generate bearer token
    const bearerToken = generateBearerToken();

    // Create new agent config
    const newAgentConfig = {
      agentId: params.agentId,
      bearerToken,
      squareAccessToken: params.squareAccessToken,
      squareRefreshToken: params.squareRefreshToken,
      squareTokenExpiresAt: params.squareTokenExpiresAt,
      squareScopes: params.squareScopes,
      squareMerchantId: params.squareMerchantId,
      supportsSellerLevelWrites: params.supportsSellerLevelWrites,
      squareLocationId: params.squareLocationId,
      defaultLocationId: params.defaultLocationId,
      squareApplicationId: params.squareApplicationId,
      staffEmail: params.staffEmail,
      timezone: params.timezone,
      businessName: params.businessName,
      squareEnvironment: params.squareEnvironment
    };

    // Add to configs
    const updatedConfigs = [...currentConfigs, newAgentConfig];

    // Update in Azure
    await updateAgentConfigs(resourceGroupName, appServiceName, updatedConfigs);

    // Restart app
    await restartAppService(resourceGroupName, appServiceName);

    logger.info('Successfully onboarded new agent', {
      agentId: params.agentId,
      businessName: params.businessName
    });

    return {
      success: true,
      agentId: params.agentId,
      bearerToken
    };
  } catch (error) {
    logger.error('Failed to add agent config', {
      agentId: params.agentId,
      message: error.message
    });
    throw error;
  }
}

module.exports = {
  getCurrentAgentConfigs,
  updateAgentConfigs,
  restartAppService,
  addAgentConfig,
  generateBearerToken
};
