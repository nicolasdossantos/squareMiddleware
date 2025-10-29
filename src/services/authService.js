const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('./database');
const tenantService = require('./tenantService');
const { logger } = require('../utils/logger');
const { config } = require('../config');

function getAccessTokenSecret() {
  const secret = config.auth?.accessTokenSecret || process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not configured');
  }
  return secret;
}

function getRefreshTokenSecret() {
  const secret = config.auth?.refreshTokenSecret || process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }
  return secret;
}

function getAccessTokenTtl() {
  return config.auth?.accessTokenTtl || process.env.JWT_ACCESS_TTL || '15m';
}

function getRefreshTokenTtlSeconds() {
  const ttl = config.auth?.refreshTokenTtl || process.env.JWT_REFRESH_TTL || '30d';
  if (typeof ttl === 'number') {
    return ttl;
  }

  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    return 60 * 60 * 24 * 30; // default 30 days
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return 60 * 60 * 24 * 30;
  }
}

function getPasswordSaltRounds() {
  return parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || config.auth?.passwordSaltRounds || 12;
}

async function hashPassword(password) {
  return bcrypt.hash(password, getPasswordSaltRounds());
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function signAccessToken(user, tenant) {
  const payload = {
    sub: user.id,
    tenantId: tenant.id,
    role: user.role,
    email: user.email,
    slug: tenant.slug
  };

  return jwt.sign(payload, getAccessTokenSecret(), {
    expiresIn: getAccessTokenTtl(),
    issuer: 'square-middleware'
  });
}

function signRefreshToken(sessionId, user, tenant) {
  const payload = {
    sub: user.id,
    tenantId: tenant.id,
    role: user.role,
    sid: sessionId,
    type: 'refresh'
  };

  return jwt.sign(payload, getRefreshTokenSecret(), {
    expiresIn: getRefreshTokenTtlSeconds(),
    issuer: 'square-middleware'
  });
}

async function issueSessionTokens(user, tenant, metadata = {}) {
  const accessToken = signAccessToken(user, tenant);
  const sessionId = crypto.randomUUID();
  const refreshToken = signRefreshToken(sessionId, user, tenant);
  const expiresInSeconds = getRefreshTokenTtlSeconds();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

  await query(
    `
      INSERT INTO tenant_user_sessions (
        id,
        tenant_user_id,
        tenant_id,
        refresh_token_hash,
        user_agent,
        ip_address,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      sessionId,
      user.id,
      tenant.id,
      refreshTokenHash,
      metadata.userAgent || null,
      metadata.ipAddress || null,
      expiresAt
    ]
  );

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
    sessionId
  };
}

async function loadUserByEmail(email) {
  const { rows } = await query(
    `
      SELECT
        tu.*,
        t.id AS tenant_id,
        t.business_name,
        t.slug AS tenant_slug,
        t.status AS tenant_status,
        t.timezone AS tenant_timezone
      FROM tenant_users tu
      INNER JOIN tenants t ON t.id = tu.tenant_id
      WHERE lower(tu.email) = lower($1)
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}

async function loadUserById(userId) {
  const { rows } = await query(
    `
      SELECT
        tu.*,
        t.id AS tenant_id,
        t.business_name,
        t.slug AS tenant_slug,
        t.status AS tenant_status,
        t.timezone AS tenant_timezone
      FROM tenant_users tu
      INNER JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function registerTenant({ businessName, email, password, timezone, industry, name, requestMeta }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await loadUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const { tenant, user } = await tenantService.createTenantWithOwner({
    businessName,
    email: normalizedEmail,
    passwordHash,
    timezone,
    industry,
    userDisplayName: name
  });

  const tokens = await issueSessionTokens(
    { id: user.id, role: user.role, email: user.email },
    { id: tenant.id, slug: tenant.slug, business_name: tenant.business_name },
    requestMeta
  );

  return {
    tenant,
    user,
    tokens
  };
}

async function authenticate({ email, password, requestMeta }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await loadUserByEmail(normalizedEmail);
  if (!user || user.is_active === false) {
    throw new Error('Invalid email or password');
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    throw new Error('Invalid email or password');
  }

  const tenant = {
    id: user.tenant_id,
    slug: user.tenant_slug,
    business_name: user.business_name
  };

  await query('UPDATE tenant_users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const tokens = await issueSessionTokens(
    { id: user.id, role: user.role, email: user.email },
    tenant,
    requestMeta
  );

  return {
    tenant,
    user,
    tokens
  };
}

async function verifyAccessToken(token) {
  return jwt.verify(token, getAccessTokenSecret(), { issuer: 'square-middleware' });
}

async function decodeRefreshToken(token) {
  return jwt.verify(token, getRefreshTokenSecret(), { issuer: 'square-middleware' });
}

async function refreshSession(refreshToken, requestMeta = {}) {
  const payload = await decodeRefreshToken(refreshToken);
  const { sid: sessionId, sub: userId } = payload;

  const { rows } = await query(
    `
      SELECT *
      FROM tenant_user_sessions
      WHERE id = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `,
    [sessionId]
  );

  const session = rows[0];
  if (!session) {
    throw new Error('Refresh token no longer valid');
  }

  const tokenMatches = await bcrypt.compare(refreshToken, session.refresh_token_hash);
  if (!tokenMatches) {
    throw new Error('Refresh token signature mismatch');
  }

  const user = await loadUserById(userId);
  if (!user || user.is_active === false) {
    throw new Error('User account disabled');
  }

  // Rotate refresh token
  const tenant = {
    id: user.tenant_id,
    slug: user.tenant_slug,
    business_name: user.business_name
  };

  const tokens = await issueSessionTokens(
    { id: user.id, role: user.role, email: user.email },
    tenant,
    requestMeta
  );

  await query(
    `
      UPDATE tenant_user_sessions
      SET revoked_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId]
  );

  return {
    tenant,
    user,
    tokens
  };
}

async function revokeRefreshToken(refreshToken) {
  try {
    const payload = await decodeRefreshToken(refreshToken);
    const { sid: sessionId } = payload;

    await query(
      `
        UPDATE tenant_user_sessions
        SET revoked_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [sessionId]
    );
  } catch (error) {
    logger.warn('refresh_token_revoke_failed', { message: error.message });
  }
}

async function revokeAllSessions(userId) {
  await query(
    `
      UPDATE tenant_user_sessions
      SET revoked_at = NOW(), updated_at = NOW()
      WHERE tenant_user_id = $1 AND revoked_at IS NULL
    `,
    [userId]
  );
}

async function getUserProfile(userId) {
  const user = await loadUserById(userId);
  if (!user) {
    return null;
  }

  const tenant = await tenantService.getTenantById(user.tenant_id);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
    phoneNumber: user.phone_number,
    isActive: user.is_active,
    lastLoginAt: user.last_login_at,
    tenant: tenant
      ? {
          id: tenant.id,
          slug: tenant.slug,
          businessName: tenant.business_name,
          status: tenant.status,
          timezone: tenant.timezone
        }
      : null
  };
}

module.exports = {
  registerTenant,
  authenticate,
  refreshSession,
  revokeRefreshToken,
  revokeAllSessions,
  verifyAccessToken,
  getUserProfile,
  hashPassword,
  verifyPassword
};
