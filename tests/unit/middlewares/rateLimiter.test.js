/**
 * Smoke tests for rateLimiter middleware
 * These tests verify the middleware is properly configured and can be imported.
 */

const rateLimiter = require('../../../src/middlewares/rateLimiter');

describe('rateLimiter middleware', () => {
  it('should be a function', () => {
    expect(typeof rateLimiter).toBe('function');
  });

  it('should be importable without errors', () => {
    expect(rateLimiter).toBeDefined();
  });
});
