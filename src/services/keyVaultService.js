const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');
const { logger } = require('../utils/logger');

/**
 * Azure Key Vault Service
 *
 * Manages secure access to secrets stored in Azure Key Vault:
 * - Retell API key (for signature verification)
 * - Per-agent configurations (Square credentials + bearer tokens)
 *
 * Features:
 * - In-memory caching (10 min TTL) to reduce Key Vault calls
 * - Automatic fallback to environment variables in development
 * - Managed Identity authentication (no credentials in code)
 */
class KeyVaultService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes
    this.client = null;
    this.initialized = false;
    this.useMock = process.env.NODE_ENV === 'development' && !process.env.USE_REAL_KEYVAULT;
  }

  /**
   * Initialize Key Vault client (lazy initialization)
   * Only called when actually needed, not during module load
   */
  _ensureInitialized() {
    if (this.initialized || this.useMock) {
      return;
    }

    const keyVaultName = process.env.AZURE_KEY_VAULT_NAME;
    if (!keyVaultName) {
      throw new Error('AZURE_KEY_VAULT_NAME environment variable is required');
    }

    const keyVaultUrl = `https://${keyVaultName}.vault.azure.net`;
    this.client = new SecretClient(keyVaultUrl, new DefaultAzureCredential());
    this.initialized = true;
  }

  /**
   * Get a secret from Key Vault with caching
   * @param {string} secretName - Name of the secret to retrieve
   * @returns {Promise<string>} Secret value
   */
  async getSecret(secretName) {
    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    // Use mock in development
    if (this.useMock) {
      const mockValue = this._getMockSecret(secretName);
      this.cache.set(secretName, {
        value: mockValue,
        timestamp: Date.now()
      });
      return mockValue;
    }

    // Initialize Key Vault client if needed
    this._ensureInitialized();

    // Fetch from Key Vault
    try {
      const secret = await this.client.getSecret(secretName);

      // Cache the result
      this.cache.set(secretName, {
        value: secret.value,
        timestamp: Date.now()
      });

      return secret.value;
    } catch (error) {
      logger.error(`[KeyVault] Failed to fetch secret ${secretName}:`, error.message);
      throw new Error(`Key Vault secret not found: ${secretName}`);
    }
  }

  /**
   * Get Retell API key for signature verification
   * @returns {Promise<string>} Retell API key
   */
  async getRetellApiKey() {
    return this.getSecret('retell-api-key');
  }

  /**
   * Get agent configuration (Square credentials + bearer token)
   * @param {string} agentId - Agent identifier
   * @returns {Promise<Object>} Agent configuration
   */
  async getAgentConfig(agentId) {
    const secretName = `agent-${agentId}`;
    const configJson = await this.getSecret(secretName);
    return JSON.parse(configJson);
  }

  /**
   * Clear cache (useful for testing or when secrets are rotated)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Mock secret retrieval for development
   * @private
   */
  _getMockSecret(secretName) {
    if (secretName === 'retell-api-key') {
      return process.env.RETELL_API_KEY || 'test-retell-api-key';
    }

    // Mock agent configuration
    if (secretName.startsWith('agent-')) {
      const agentId = secretName.replace('agent-', '');
      return JSON.stringify({
        agentId,
        bearerToken: process.env.MOCK_BEARER_TOKEN || 'test-bearer-token',
        squareAccessToken: process.env.SQUARE_ACCESS_TOKEN || 'test-square-token',
        squareLocationId: process.env.SQUARE_LOCATION_ID || 'test-location',
        defaultLocationId: process.env.SQUARE_LOCATION_ID || 'test-location',
        squareEnvironment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
        squareRefreshToken: process.env.SQUARE_REFRESH_TOKEN || 'test-refresh-token',
        squareTokenExpiresAt:
          process.env.SQUARE_TOKEN_EXPIRES_AT ||
          new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), // +25 days
        squareScopes: (process.env.SQUARE_SCOPES || 'APPOINTMENTS_READ,APPOINTMENTS_WRITE')
          .split(',')
          .map(scope => scope.trim())
          .filter(Boolean),
        squareMerchantId: process.env.SQUARE_MERCHANT_ID || 'test-merchant-id',
        supportsSellerLevelWrites: process.env.SUPPORTS_SELLER_LEVEL_WRITES === 'true',
        timezone: process.env.TIMEZONE || 'America/New_York',
        businessName: process.env.BUSINESS_NAME || 'Test Business'
      });
    }

    throw new Error(`Mock secret not found: ${secretName}`);
  }

  /**
   * Set a secret in Key Vault
   * @param {string} secretName - Secret name
   * @param {string} secretValue - Secret value
   * @returns {Promise}
   */
  async setSecret(secretName, secretValue) {
    if (this.useMock) {
      logger.warn(`Mock mode: Cannot set secret ${secretName}`);
      throw new Error('Cannot set secrets in mock mode');
    }

    try {
      const client = this.getClient();

      logger.info('Setting secret in Key Vault', { secretName });

      await client.setSecret(secretName, secretValue);

      logger.info('Secret set successfully', { secretName });

      return { success: true };
    } catch (error) {
      logger.error('Failed to set secret', {
        secretName,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new KeyVaultService();
