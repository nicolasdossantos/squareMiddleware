/**
 * Agent Configuration Service
 *
 * Manages multi-tenant agent configurations stored in environment variables.
 * Replaces Azure Key Vault with simpler App Settings approach.
 *
 * Configuration is stored as JSON in AGENT_CONFIGS environment variable.
 */

const { logger } = require('../utils/logger');

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Unable to parse AGENT_CONFIGS JSON: ${error.message}`);
  }
}

class AgentConfigService {
  constructor() {
    this.agents = new Map();
    this.initialized = false;
  }

  /**
   * Initialize agent configurations from environment
   * @private
   */
  _initialize() {
    if (this.initialized) return;

    try {
      const raw = process.env.AGENT_CONFIGS;
      let configs = [];

      if (raw && raw.trim() !== '') {
        const parsed = tryParseJson(raw);

        if (!Array.isArray(parsed)) {
          throw new Error('AGENT_CONFIGS must be a JSON array');
        }

        configs = parsed;
      }

      // Validate and store each agent config
      configs.forEach(config => {
        this._validateAgentConfig(config);
        this.agents.set(config.agentId, config);
      });

      logger.info(`[AgentConfig] Loaded ${this.agents.size} agent configuration(s)`);
      this.initialized = true;
    } catch (error) {
      logger.error('[AgentConfig] Failed to load agent configurations:', error.message);
      throw new Error(`Agent configuration initialization failed: ${error.message}`);
    }
  }

  /**
   * Validate agent configuration structure
   * @private
   */
  _validateAgentConfig(config) {
    const required = [
      'agentId',
      'bearerToken',
      'squareAccessToken',
      'squareLocationId',
      'squareApplicationId',
      'timezone'
    ];

    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Agent config missing required fields: ${missing.join(', ')}`);
    }

    // Validate Square access token format
    if (config.squareAccessToken.length < 20) {
      throw new Error(`Invalid Square access token for agent ${config.agentId}`);
    }

    // Normalize scopes (allow comma-separated string)
    if (typeof config.squareScopes === 'string') {
      config.squareScopes = config.squareScopes
        .split(',')
        .map(scope => scope.trim())
        .filter(Boolean);
    }

    if (config.squareScopes && !Array.isArray(config.squareScopes)) {
      throw new Error('squareScopes must be an array of strings or a comma-separated string');
    }

    if (typeof config.supportsSellerLevelWrites !== 'undefined') {
      config.supportsSellerLevelWrites = Boolean(config.supportsSellerLevelWrites);
    }

    if (config.tenantId && typeof config.tenantId !== 'string') {
      throw new Error('tenantId must be a string when provided');
    }

    if (config.squareTokenExpiresAt && isNaN(Date.parse(config.squareTokenExpiresAt))) {
      logger.warn('Invalid squareTokenExpiresAt detected; ignoring value', {
        agentId: config.agentId,
        squareTokenExpiresAt: config.squareTokenExpiresAt
      });
      delete config.squareTokenExpiresAt;
    }
  }

  /**
   * Get agent configuration by agent ID
   * @param {string} agentId - Agent identifier
   * @returns {Object} Agent configuration
   * @throws {Error} If agent not found
   */
  getAgentConfig(agentId) {
    this._initialize();

    const config = this.agents.get(agentId);

    if (!config) {
      throw new Error(`Agent configuration not found: ${agentId}`);
    }

    return {
      tenantId: config.tenantId || null,
      agentId: config.agentId,
      bearerToken: config.bearerToken,
      squareAccessToken: config.squareAccessToken,
      squareRefreshToken: config.squareRefreshToken,
      squareTokenExpiresAt: config.squareTokenExpiresAt,
      squareScopes: config.squareScopes,
      squareMerchantId: config.squareMerchantId || config.merchantId,
      supportsSellerLevelWrites:
        typeof config.supportsSellerLevelWrites === 'boolean' ? config.supportsSellerLevelWrites : null,
      squareLocationId: config.squareLocationId,
      defaultLocationId: config.defaultLocationId || config.squareLocationId,
      squareApplicationId: config.squareApplicationId,
      squareEnvironment: config.squareEnvironment || this._getSquareEnvironment(),
      timezone: config.timezone,
      staffEmail: config.staffEmail,
      businessName: config.businessName,
      locations: config.locations,
      metadata: config.metadata
    };
  }

  /**
   * Validate bearer token for agent
   * @param {string} agentId - Agent identifier
   * @param {string} bearerToken - Token to validate
   * @returns {boolean} True if valid
   */
  validateBearerToken(agentId, bearerToken) {
    this._initialize();

    const config = this.agents.get(agentId);

    if (!config) {
      return false;
    }

    return config.bearerToken === bearerToken;
  }

  /**
   * Get all agent IDs
   * @returns {string[]} Array of agent IDs
   */
  getAllAgentIds() {
    this._initialize();
    return Array.from(this.agents.keys());
  }

  /**
   * Get Square environment based on NODE_ENV
   * Always returns 'production' in production, 'sandbox' otherwise
   * @private
   */
  _getSquareEnvironment() {
    return process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
  }

  /**
   * Reload configurations (useful for testing)
   */
  reload() {
    this.agents.clear();
    this.initialized = false;
    this._initialize();
  }

  /**
   * Get all agents (for admin panel)
   * @returns {Map}
   */
  getAllAgents() {
    this._initialize();
    return this.agents;
  }

  /**
   * Add a new agent configuration (runtime)
   * @param {Object} agentConfig - Agent configuration
   */
  addAgentConfig(agentConfig) {
    this._initialize();

    if (!agentConfig.agentId) {
      throw new Error('agentId is required');
    }

    this._validateAgentConfig(agentConfig);

    const normalizedConfig = {
      ...agentConfig,
      squareEnvironment: agentConfig.squareEnvironment || this._getSquareEnvironment()
    };

    this.agents.set(agentConfig.agentId, normalizedConfig);
    logger.info('Agent config added', { agentId: agentConfig.agentId });
  }

  /**
   * Remove an agent configuration (runtime)
   * @param {string} agentId - Agent ID to remove
   */
  removeAgentConfig(agentId) {
    this._initialize();

    if (!this.agents.has(agentId)) {
      throw new Error(`Agent ${agentId} not found`);
    }

    this.agents.delete(agentId);
    logger.info('Agent config removed', { agentId });
  }
}

// Export singleton instance
module.exports = new AgentConfigService();
