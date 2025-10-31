/**
 * Session Store Service
 * In-memory store for active Retell call sessions
 * Maps call_id → agent credentials
 *
 * Session lifecycle:
 * 1. call_inbound webhook → Create session
 * 2. Tool calls → Look up session by call_id
 * 3. call_analyzed webhook → Destroy session
 * 4. Timeout → Auto-cleanup after 10 minutes
 */

const { logger } = require('../utils/logger');

class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.cleanupIntervals = new Map();

    // Cleanup interval: Check for expired sessions every 30 seconds
    this.globalCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 30000);
  }

  /**
   * Create a new call session
   * @param {string} callId - Unique call identifier from Retell
   * @param {string} agentId - Agent ID making the call
   * @param {object} credentials - Square credentials { accessToken, locationId, environment, timezone }
   * @param {number} ttlSeconds - Time to live (default 600 = 10 minutes)
   * @returns {object} Session object
   */
  createSession(callId, agentId, credentials, ttlSeconds = 600, metadata = {}) {
    if (!callId || !agentId || !credentials) {
      throw new Error('callId, agentId, and credentials are required');
    }

    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;

    const session = {
      callId,
      agentId,
      tenantId: metadata?.tenantId || credentials.tenantId || null,
      credentials: {
        squareAccessToken: credentials.accessToken || credentials.squareAccessToken,
        squareLocationId: credentials.locationId || credentials.squareLocationId,
        squareEnvironment: credentials.environment || 'production',
        timezone: credentials.timezone || 'America/New_York',
        businessName: credentials.businessName
      },
      metadata: { ...(metadata || {}) },
      createdAt: now,
      expiresAt,
      lastAccessedAt: now,
      accessCount: 0
    };

    this.sessions.set(callId, session);

    logger.info('Session created', {
      callId,
      agentId,
      expiresInSeconds: ttlSeconds,
      totalSessions: this.sessions.size
    });

    return session;
  }

  /**
   * Update session metadata with additional fields
   * @param {string} callId
   * @param {object} updates
   * @returns {object|null}
   */
  updateSession(callId, updates = {}) {
    const session = this.sessions.get(callId);

    if (!session) {
      logger.warn('Attempted to update non-existent session', { callId });
      return null;
    }

    session.metadata = {
      ...(session.metadata || {}),
      ...(updates || {})
    };
    if (Object.prototype.hasOwnProperty.call(updates || {}, 'tenantId')) {
      session.tenantId = updates.tenantId;
    }
    session.lastAccessedAt = Date.now();

    logger.debug('Session metadata updated', {
      callId,
      keys: Object.keys(updates || {}),
      accessCount: session.accessCount
    });

    return session;
  }

  /**
   * Get a shallow copy of session metadata
   * @param {string} callId
   * @returns {object|null}
   */
  getSessionMetadata(callId) {
    const session = this.getSession(callId);
    if (!session || !session.metadata) {
      return null;
    }
    return { ...session.metadata };
  }

  /**
   * Get an active session
   * @param {string} callId - Call ID to lookup
   * @returns {object|null} Session if found and not expired, null otherwise
   */
  getSession(callId) {
    const session = this.sessions.get(callId);

    if (!session) {
      logger.debug('Session not found', { callId });
      return null;
    }

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      logger.debug('Session expired', { callId });
      this.sessions.delete(callId);
      return null;
    }

    // Update access tracking
    session.lastAccessedAt = Date.now();
    session.accessCount++;

    logger.debug('Session found', { callId, accessCount: session.accessCount });

    return session;
  }

  /**
   * Destroy a session (when call ends)
   * @param {string} callId - Call ID to destroy
   * @returns {boolean} True if session was destroyed
   */
  destroySession(callId) {
    const existed = this.sessions.has(callId);

    if (existed) {
      this.sessions.delete(callId);
      logger.info('Session destroyed', { callId, remainingSessions: this.sessions.size });
    } else {
      logger.warn('Attempted to destroy non-existent session', { callId });
    }

    return existed;
  }

  /**
   * Clean up expired sessions
   * @returns {number} Number of sessions cleaned up
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [callId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(callId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Auto-cleanup expired sessions', {
        cleanedCount: cleaned,
        remainingSessions: this.sessions.size
      });
    }

    return cleaned;
  }

  /**
   * Get all active sessions (for monitoring/debugging)
   * @returns {array} Array of session summaries
   */
  getAllSessions() {
    const now = Date.now();
    const sessions = [];

    for (const [callId, session] of this.sessions.entries()) {
      const isExpired = now > session.expiresAt;
      sessions.push({
        callId,
        agentId: session.agentId,
        tenantId: session.tenantId || null,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
        expiresIn: Math.ceil((session.expiresAt - now) / 1000) + 's',
        accessCount: session.accessCount,
        metadataKeys: Object.keys(session.metadata || {}),
        isExpired
      });
    }

    return sessions;
  }

  /**
   * Get active session count
   * @returns {number}
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Shutdown - clean up interval
   */
  shutdown() {
    if (this.globalCleanupInterval) {
      clearInterval(this.globalCleanupInterval);
      logger.info('SessionStore shutdown: Global cleanup interval cleared', {
        activeSessions: this.sessions.size
      });
    }
  }
}

// Export singleton instance
module.exports = new SessionStore();
