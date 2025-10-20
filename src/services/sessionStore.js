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
  createSession(callId, agentId, credentials, ttlSeconds = 600) {
    if (!callId || !agentId || !credentials) {
      throw new Error('callId, agentId, and credentials are required');
    }

    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;

    const session = {
      callId,
      agentId,
      credentials: {
        squareAccessToken: credentials.accessToken || credentials.squareAccessToken,
        squareLocationId: credentials.locationId || credentials.squareLocationId,
        squareEnvironment: credentials.environment || 'production',
        timezone: credentials.timezone || 'America/New_York',
        businessName: credentials.businessName
      },
      createdAt: now,
      expiresAt,
      lastAccessedAt: now,
      accessCount: 0
    };

    this.sessions.set(callId, session);

    console.log(
      `[SessionStore] 📝 Session created: ${callId} (agent: ${agentId}, expires in ${ttlSeconds}s)`
    );

    return session;
  }

  /**
   * Get an active session
   * @param {string} callId - Call ID to lookup
   * @returns {object|null} Session if found and not expired, null otherwise
   */
  getSession(callId) {
    const session = this.sessions.get(callId);

    if (!session) {
      console.log(`[SessionStore] ❌ Session not found: ${callId}`);
      return null;
    }

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      console.log(`[SessionStore] ⏱️  Session expired: ${callId}`);
      this.sessions.delete(callId);
      return null;
    }

    // Update access tracking
    session.lastAccessedAt = Date.now();
    session.accessCount++;

    console.log(`[SessionStore] ✅ Session found: ${callId} (access #${session.accessCount})`);

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
      console.log(`[SessionStore] 🗑️  Session destroyed: ${callId}`);
    } else {
      console.log(`[SessionStore] ⚠️  Attempted to destroy non-existent session: ${callId}`);
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
        console.log(`[SessionStore] 🧹 Auto-cleanup expired session: ${callId}`);
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionStore] Cleaned up ${cleaned} expired sessions (${this.sessions.size} remaining)`);
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
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
        expiresIn: Math.ceil((session.expiresAt - now) / 1000) + 's',
        accessCount: session.accessCount,
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
      console.log('[SessionStore] Shutdown: Global cleanup interval cleared');
    }
  }
}

// Export singleton instance
module.exports = new SessionStore();
