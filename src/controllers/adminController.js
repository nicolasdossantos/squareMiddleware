/**
 * Admin Controller
 * Tenant onboarding and management operations
 */

const { logger } = require('../utils/logger');
const agentConfigService = require('../services/agentConfigService');
const keyVaultService = require('../services/keyVaultService');
const { Client: SquareClient, Environment } = require('square/legacy');

/**
 * List all configured tenants
 */
async function listTenants(req, res) {
  try {
    const agents = agentConfigService.getAllAgents();

    // Return safe subset of agent data (no tokens)
    const tenants = Array.from(agents.values()).map(agent => ({
      agentId: agent.agentId,
      businessName: agent.businessName,
      squareEnvironment: agent.squareEnvironment,
      timezone: agent.timezone,
      squareMerchantId: agent.squareMerchantId || agent.merchantId,
      supportsSellerLevelWrites:
        typeof agent.supportsSellerLevelWrites === 'boolean' ? agent.supportsSellerLevelWrites : null,
      hasRefreshToken: Boolean(agent.squareRefreshToken),
      defaultLocationId: agent.defaultLocationId || agent.squareLocationId,
      squareScopes: agent.squareScopes,
      contactEmail: agent.contactEmail,
      contactPhone: agent.contactPhone
    }));

    res.json({
      success: true,
      tenants,
      count: tenants.length
    });
  } catch (error) {
    logger.error('Failed to list tenants', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Test Square API credentials
 */
async function testCredentials(req, res) {
  try {
    const { squareAccessToken, squareLocationId, squareEnvironment } = req.body;

    if (!squareAccessToken || !squareLocationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: squareAccessToken, squareLocationId'
      });
    }

    // Create Square client
    const client = new SquareClient({
      accessToken: squareAccessToken,
      environment: squareEnvironment === 'sandbox' ? Environment.Sandbox : Environment.Production
    });

    // Test API call - get location details
    const response = await client.locationsApi.retrieveLocation(squareLocationId);

    if (response.result?.location) {
      logger.info('Credentials test successful', {
        locationId: squareLocationId,
        locationName: response.result.location.name
      });

      return res.json({
        success: true,
        locationName: response.result.location.name,
        locationAddress: response.result.location.address?.addressLine1 || 'N/A'
      });
    } else {
      throw new Error('Invalid response from Square API');
    }
  } catch (error) {
    logger.error('Credentials test failed', {
      error: error.message,
      statusCode: error.statusCode
    });

    res.status(400).json({
      success: false,
      error: error.message || 'Invalid credentials'
    });
  }
}

/**
 * Onboard a new tenant
 */
async function onboardTenant(req, res) {
  try {
    const {
      agentId,
      businessName,
      squareAccessToken,
      squareRefreshToken,
      squareTokenExpiresAt,
      squareScopes,
      squareMerchantId,
      supportsSellerLevelWrites,
      defaultLocationId,
      squareLocationId,
      squareEnvironment,
      contactEmail,
      contactPhone,
      timezone
    } = req.body;

    // Validate required fields
    if (
      !agentId ||
      !businessName ||
      !squareAccessToken ||
      !squareLocationId ||
      !contactEmail ||
      !contactPhone
    ) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Check if agent already exists
    try {
      agentConfigService.getAgentConfig(agentId);
      return res.status(409).json({
        success: false,
        error: `Agent ${agentId} already exists`
      });
    } catch (e) {
      // Agent doesn't exist - good, continue
    }

    // Test credentials first
    const client = new SquareClient({
      accessToken: squareAccessToken,
      environment: squareEnvironment === 'sandbox' ? Environment.Sandbox : Environment.Production
    });

    try {
      await client.locationsApi.retrieveLocation(squareLocationId);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Square credentials or location ID'
      });
    }

    // Normalize optional OAuth metadata
    const normalizedScopes =
      typeof squareScopes === 'string'
        ? squareScopes
            .split(',')
            .map(scope => scope.trim())
            .filter(Boolean)
        : Array.isArray(squareScopes)
        ? squareScopes
        : undefined;

    const normalizedSupportsSellerLevelWrites =
      supportsSellerLevelWrites === true ||
      supportsSellerLevelWrites === 'true' ||
      supportsSellerLevelWrites === 1 ||
      supportsSellerLevelWrites === '1';

    let normalizedExpiresAt;
    if (squareTokenExpiresAt && squareTokenExpiresAt !== '') {
      const parsedExpire = new Date(squareTokenExpiresAt);
      if (!Number.isNaN(parsedExpire.getTime())) {
        normalizedExpiresAt = parsedExpire.toISOString();
      } else {
        logger.warn('Invalid squareTokenExpiresAt provided during onboarding; ignoring value', {
          agentId,
          squareTokenExpiresAt
        });
      }
    }

    const merchantId = squareMerchantId || req.body.merchantId;

    // Create agent configuration
    const agentConfig = {
      agentId,
      businessName,
      squareAccessToken,
      squareLocationId,
      squareEnvironment: squareEnvironment || 'production',
      timezone: timezone || 'America/New_York',
      contactEmail,
      contactPhone,
      staffEmail: contactEmail,
      squareRefreshToken,
      squareTokenExpiresAt: normalizedExpiresAt,
      squareScopes: normalizedScopes,
      squareMerchantId: merchantId,
      supportsSellerLevelWrites: normalizedSupportsSellerLevelWrites,
      defaultLocationId: defaultLocationId || squareLocationId
    };

    // Store in Azure Key Vault (if available)
    const keyVaultName = process.env.AZURE_KEY_VAULT_NAME;
    if (keyVaultName) {
      try {
        const secretName = `agent-${agentId.replace('agent_', '')}`;
        await keyVaultService.setSecret(secretName, JSON.stringify(agentConfig));
        logger.info('Agent config stored in Key Vault', { agentId, secretName });
      } catch (kvError) {
        logger.warn('Failed to store in Key Vault, using environment variables', {
          error: kvError.message
        });
      }
    }

    // Add to runtime configuration
    agentConfigService.addAgentConfig(agentConfig);

    logger.info('Tenant onboarded successfully', {
      agentId,
      businessName,
      environment: squareEnvironment
    });

    res.json({
      success: true,
      message: 'Tenant onboarded successfully',
      agentId,
      supportsSellerLevelWrites: normalizedSupportsSellerLevelWrites,
      squareMerchantId: merchantId
    });
  } catch (error) {
    logger.error('Failed to onboard tenant', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Remove a tenant
 */
async function removeTenant(req, res) {
  try {
    const { agentId } = req.params;

    // Remove from runtime config
    agentConfigService.removeAgentConfig(agentId);

    logger.info('Tenant removed', { agentId });

    res.json({
      success: true,
      message: 'Tenant removed successfully'
    });
  } catch (error) {
    logger.error('Failed to remove tenant', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  listTenants,
  testCredentials,
  onboardTenant,
  removeTenant
};
