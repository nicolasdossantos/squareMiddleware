/**
 * Smoke tests for retellAuth middleware
 * These tests verify the middleware is properly configured and can be imported.
 */

// Set mock environment before requiring dependencies
process.env.NODE_ENV = 'development';
delete process.env.USE_REAL_KEYVAULT;

const retellAuth = require('../../../src/middlewares/retellAuth');

describe('retellAuth middleware', () => {
  it('should be a function', () => {
    expect(typeof retellAuth).toBe('function');
  });

  it('should accept 3 parameters (req, res, next)', () => {
    expect(retellAuth.length).toBe(3);
  });

  it('should be importable without errors', () => {
    expect(retellAuth).toBeDefined();
  });
});
