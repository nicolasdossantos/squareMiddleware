/**
 * Smoke tests for keyVaultService
 * These tests verify the service is properly configured in development/mock mode.
 */

// Set mock environment before requiring the service
process.env.NODE_ENV = 'development';
delete process.env.USE_REAL_KEYVAULT;

const keyVaultService = require('../../../src/services/keyVaultService');

describe('keyVaultService', () => {
  beforeEach(() => {
    keyVaultService.clearCache();
  });

  describe('Service Configuration', () => {
    it('should be properly exported', () => {
      expect(keyVaultService).toBeDefined();
    });

    it('should have getSecret method', () => {
      expect(typeof keyVaultService.getSecret).toBe('function');
    });

    it('should have getRetellApiKey method', () => {
      expect(typeof keyVaultService.getRetellApiKey).toBe('function');
    });

    it('should have getAgentConfig method', () => {
      expect(typeof keyVaultService.getAgentConfig).toBe('function');
    });

    it('should have clearCache method', () => {
      expect(typeof keyVaultService.clearCache).toBe('function');
    });
  });

  describe('Mock Mode (Development)', () => {
    it('should return mock Retell API key in development', async () => {
      const apiKey = await keyVaultService.getRetellApiKey();

      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBeGreaterThan(0);
    });

    it('should return mock agent config', async () => {
      const agentConfig = await keyVaultService.getAgentConfig('test_agent_123');

      expect(agentConfig).toBeDefined();
      expect(agentConfig.agentId).toBe('test_agent_123');
      expect(agentConfig.squareAccessToken).toBeDefined();
      expect(agentConfig.squareLocationId).toBeDefined();
      expect(agentConfig.squareEnvironment).toBe('sandbox');
    });
  });

  describe('Cache Functionality', () => {
    it('should cache Retell API key', async () => {
      const key1 = await keyVaultService.getRetellApiKey();
      const key2 = await keyVaultService.getRetellApiKey();

      expect(key1).toBe(key2);
    });

    it('should cache agent config', async () => {
      const config1 = await keyVaultService.getAgentConfig('agent_xyz');
      const config2 = await keyVaultService.getAgentConfig('agent_xyz');

      expect(config1).toEqual(config2);
    });

    it('should clear cache when clearCache is called', () => {
      keyVaultService.clearCache();
      expect(keyVaultService.cache.size).toBe(0);
    });
  });
});
