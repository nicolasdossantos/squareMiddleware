/**
 * Smoke tests for agentAuth middleware
 * These tests verify the middleware is properly configured and can be imported.
 */

// Set mock environment before requiring dependencies
process.env.NODE_ENV = 'development';
delete process.env.USE_REAL_KEYVAULT;

const agentAuth = require('../../../src/middlewares/agentAuth');

describe('agentAuth middleware', () => {
  it('should be a function', () => {
    expect(typeof agentAuth).toBe('function');
  });

  it('should accept 3 parameters (req, res, next)', () => {
    expect(agentAuth.length).toBe(3);
  });

  it('should be importable without errors', () => {
    expect(agentAuth).toBeDefined();
  });
});
