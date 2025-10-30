const authService = require('../services/authService');
const tenantService = require('../services/tenantService');
const { logger } = require('../utils/logger');

const REFRESH_COOKIE_NAME = 'refreshToken';

function getCookieBaseOptions() {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = 'strict';
  const domain = process.env.AUTH_COOKIE_DOMAIN || undefined;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/auth',
    domain
  };
}

function setRefreshTokenCookie(res, refreshToken, expiresAt) {
  if (!refreshToken) {
    return;
  }

  if (typeof res.cookie !== 'function') {
    return;
  }

  const ttlMs = expiresAt instanceof Date ? Math.max(expiresAt.getTime() - Date.now(), 0) : undefined;
  const defaultTtl = 30 * 24 * 60 * 60 * 1000; // 30 days

  const options = {
    ...getCookieBaseOptions(),
    maxAge: ttlMs && ttlMs > 0 ? ttlMs : defaultTtl
  };

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, options);
}

function clearRefreshTokenCookie(res) {
  if (typeof res.clearCookie !== 'function') {
    return;
  }

  const options = {
    ...getCookieBaseOptions(),
    maxAge: 0
  };

  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

function extractRequestMeta(req) {
  return {
    userAgent: req.get('user-agent') || null,
    ipAddress: req.ip || req.connection?.remoteAddress || null
  };
}

function sanitizeTenant(tenant) {
  if (!tenant) return null;
  return {
    id: tenant.id,
    slug: tenant.slug,
    businessName: tenant.business_name || tenant.businessName,
    status: tenant.status,
    timezone: tenant.timezone,
    qaStatus: tenant.qa_status || tenant.qaStatus,
    trialEndsAt: tenant.trial_ends_at || tenant.trialEndsAt
  };
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name || user.displayName,
    phoneNumber: user.phone_number || user.phoneNumber,
    isActive: user.is_active !== false,
    lastLoginAt: user.last_login_at || user.lastLoginAt
  };
}

async function signup(req, res) {
  try {
    const { businessName, email, password, timezone, industry, name } = req.body || {};

    if (!businessName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'missing_required_fields',
        message: 'businessName, email, and password are required'
      });
    }

    const result = await authService.registerTenant({
      businessName,
      email,
      password,
      timezone,
      industry,
      name,
      requestMeta: extractRequestMeta(req)
    });

    setRefreshTokenCookie(res, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);

    return res.status(201).json({
      success: true,
      tenant: sanitizeTenant(result.tenant),
      user: sanitizeUser(result.user),
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: null,
        refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt
      }
    });
  } catch (error) {
    logger.error('auth_signup_failed', { message: error.message });
    return res.status(400).json({
      success: false,
      error: 'signup_failed',
      message: error.message
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'missing_credentials',
        message: 'email and password are required'
      });
    }

    const result = await authService.authenticate({
      email,
      password,
      requestMeta: extractRequestMeta(req)
    });

    setRefreshTokenCookie(res, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);

    return res.json({
      success: true,
      tenant: sanitizeTenant(result.tenant),
      user: sanitizeUser(result.user),
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: null,
        refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt
      }
    });
  } catch (error) {
    logger.warn('auth_login_failed', { message: error.message });
    return res.status(401).json({
      success: false,
      error: 'authentication_failed',
      message: 'Invalid email or password'
    });
  }
}

async function refresh(req, res) {
  try {
    const providedToken = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];

    if (!providedToken) {
      return res.status(400).json({
        success: false,
        error: 'missing_refresh_token',
        message: 'refresh token not provided'
      });
    }

    const result = await authService.refreshSession(providedToken, extractRequestMeta(req));

    setRefreshTokenCookie(res, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);

    return res.json({
      success: true,
      tenant: sanitizeTenant(result.tenant),
      user: sanitizeUser(result.user),
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: null,
        refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt
      }
    });
  } catch (error) {
    logger.warn('auth_refresh_failed', { message: error.message });
    return res.status(401).json({
      success: false,
      error: 'refresh_failed',
      message: error.message
    });
  }
}

async function logout(req, res) {
  try {
    const bodyRefreshToken = req.body?.refreshToken;
    const cookieRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const { all } = req.body || {};
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    if (all === true) {
      await authService.revokeAllSessions(userId);
    } else if (bodyRefreshToken || cookieRefreshToken) {
      await authService.revokeRefreshToken(bodyRefreshToken || cookieRefreshToken);
    } else {
      await authService.revokeAllSessions(userId);
    }

    clearRefreshTokenCookie(res);

    return res.json({ success: true });
  } catch (error) {
    logger.warn('auth_logout_failed', { message: error.message });
    return res.status(500).json({
      success: false,
      error: 'logout_failed',
      message: 'Failed to revoke session'
    });
  }
}

async function me(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const profile = await authService.getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      user: profile
    });
  } catch (error) {
    logger.error('auth_me_failed', { message: error.message });
    return res.status(500).json({
      success: false,
      error: 'profile_failed',
      message: 'Failed to load profile'
    });
  }
}

async function tenantContext(req, res) {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const tenant = await tenantService.getTenantContext(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Tenant not found'
      });
    }

    return res.json({
      success: true,
      tenant
    });
  } catch (error) {
    logger.error('auth_tenant_context_failed', { message: error.message });
    return res.status(500).json({
      success: false,
      error: 'tenant_context_failed',
      message: 'Failed to load tenant context'
    });
  }
}

module.exports = {
  signup,
  login,
  refresh,
  logout,
  me,
  tenantContext
};
