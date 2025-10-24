const crypto = require('crypto');
const agentConfigService = require('../src/services/agentConfigService');

process.env.AGENT_CONFIG_ENCRYPTION_KEY = process.argv[2];
process.env.AGENT_CONFIGS = process.argv[3];

try {
  agentConfigService.reload();
  const config = agentConfigService.getAgentConfig('agent_c6d197382e23c9603d183e0be8');
  console.log('Loaded config:', JSON.stringify(config, null, 2));
} catch (error) {
  console.error('Load failed:', error.message);
}
