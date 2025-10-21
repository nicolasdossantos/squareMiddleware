/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when Square API is down
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 *
 * Configuration (per tenant):
 * - failureThreshold: Number of failures before opening (default: 5)
 * - failureTimeout: Time window for counting failures (default: 60s)
 * - resetTimeout: Time to wait before half-open (default: 30s)
 */

const { logger } = require('./logger');

const STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.failureTimeout = options.failureTimeout || 60000; // 60 seconds
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds

    // Per-tenant circuit state
    // Structure: { [tenantId]: { state, failures: [], nextAttempt } }
    this.circuits = new Map();
  }

  /**
   * Get or create circuit for tenant
   */
  getCircuit(tenantId) {
    if (!this.circuits.has(tenantId)) {
      this.circuits.set(tenantId, {
        state: STATE.CLOSED,
        failures: [],
        nextAttempt: null
      });
    }
    return this.circuits.get(tenantId);
  }

  /**
   * Record a failure for tenant
   */
  recordFailure(tenantId, error) {
    const circuit = this.getCircuit(tenantId);
    const now = Date.now();

    // Add failure
    circuit.failures.push(now);

    // Remove old failures outside time window
    circuit.failures = circuit.failures.filter(timestamp => now - timestamp < this.failureTimeout);

    // Check if threshold exceeded
    if (circuit.failures.length >= this.failureThreshold) {
      circuit.state = STATE.OPEN;
      circuit.nextAttempt = now + this.resetTimeout;

      logger.error('Circuit breaker OPENED for tenant', {
        tenantId,
        failures: circuit.failures.length,
        nextAttemptIn: this.resetTimeout / 1000 + 's',
        error: error.message
      });
    }
  }

  /**
   * Record a success for tenant
   */
  recordSuccess(tenantId) {
    const circuit = this.getCircuit(tenantId);

    // Reset failures
    circuit.failures = [];

    // Close circuit if it was half-open
    if (circuit.state === STATE.HALF_OPEN) {
      circuit.state = STATE.CLOSED;
      logger.info('Circuit breaker CLOSED for tenant', { tenantId });
    }
  }

  /**
   * Check if circuit allows request
   */
  canAttempt(tenantId) {
    const circuit = this.getCircuit(tenantId);
    const now = Date.now();

    switch (circuit.state) {
      case STATE.CLOSED:
        return true;

      case STATE.OPEN:
        // Check if enough time has passed to try half-open
        if (now >= circuit.nextAttempt) {
          circuit.state = STATE.HALF_OPEN;
          logger.info('Circuit breaker HALF-OPEN for tenant', { tenantId });
          return true;
        }
        return false;

      case STATE.HALF_OPEN:
        return true;

      default:
        return true;
    }
  }

  /**
   * Get circuit state for monitoring
   */
  getState(tenantId) {
    const circuit = this.getCircuit(tenantId);
    return {
      state: circuit.state,
      failures: circuit.failures.length,
      nextAttempt: circuit.nextAttempt ? new Date(circuit.nextAttempt).toISOString() : null
    };
  }

  /**
   * Execute function with circuit breaker protection
   * @param {string} tenantId - Tenant identifier
   * @param {Function} fn - Async function to execute
   * @param {string} operationName - Name for logging
   * @returns {Promise} Result of function or circuit breaker error
   */
  async execute(tenantId, fn, operationName = 'Square API') {
    // Check if circuit allows request
    if (!this.canAttempt(tenantId)) {
      const circuit = this.getCircuit(tenantId);
      const error = new Error('Circuit breaker is OPEN - service unavailable');
      error.code = 'CIRCUIT_BREAKER_OPEN';
      error.statusCode = 503;
      error.retryAfter = Math.ceil((circuit.nextAttempt - Date.now()) / 1000);

      logger.warn('Circuit breaker rejected request', {
        tenantId,
        operation: operationName,
        retryAfter: error.retryAfter + 's'
      });

      throw error;
    }

    try {
      // Execute function
      const result = await fn();

      // Record success
      this.recordSuccess(tenantId);

      return result;
    } catch (error) {
      // Record failure for Square API errors (5xx or network errors)
      if (
        error.statusCode >= 500 ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND'
      ) {
        this.recordFailure(tenantId, error);
      }

      // Re-throw error
      throw error;
    }
  }

  /**
   * Reset circuit for tenant (for testing/admin)
   */
  reset(tenantId) {
    if (tenantId) {
      this.circuits.delete(tenantId);
      logger.info('Circuit breaker reset for tenant', { tenantId });
    } else {
      this.circuits.clear();
      logger.info('All circuit breakers reset');
    }
  }

  /**
   * Get all circuit states (for monitoring)
   */
  getAllStates() {
    const states = {};
    for (const [tenantId, circuit] of this.circuits.entries()) {
      states[tenantId] = {
        state: circuit.state,
        failures: circuit.failures.length,
        nextAttempt: circuit.nextAttempt ? new Date(circuit.nextAttempt).toISOString() : null
      };
    }
    return states;
  }
}

// Export singleton instance
module.exports = new CircuitBreaker({
  failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
  failureTimeout: parseInt(process.env.CIRCUIT_BREAKER_WINDOW) || 60000,
  resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET) || 30000
});
