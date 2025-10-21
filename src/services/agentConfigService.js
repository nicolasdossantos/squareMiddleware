/**
 * Agent Configuration Service
 *
 * Manages multi-tenant agent configurations stored in environment variables.
 * Replaces Azure Key Vault with simpler App Settings approach.
 *
 * Configuration is stored as JSON in AGENT_CONFIGS environment variable.
 */

const { logError, logger } = require('../utils/logger');

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
      // Load agent configurations from environment variable
      const configJson = process.env.AGENT_CONFIGS || '[]';
      const configs = JSON.parse(configJson);

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
      agentId: config.agentId,
      bearerToken: config.bearerToken,
      squareAccessToken: config.squareAccessToken,
      squareLocationId: config.squareLocationId,
      squareApplicationId: config.squareApplicationId,
      squareEnvironment: this._getSquareEnvironment(),
      timezone: config.timezone,
      staffEmail: config.staffEmail,
      businessName: config.businessName
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

    this.agents.set(agentConfig.agentId, agentConfig);
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
