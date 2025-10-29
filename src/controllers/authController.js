const authService = require('../services/authService');
const tenantService = require('../services/tenantService');
const { logger } = require('../utils/logger');

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

    return res.status(201).json({
      success: true,
      tenant: sanitizeTenant(result.tenant),
      user: sanitizeUser(result.user),
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
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

    return res.json({
      success: true,
      tenant: sanitizeTenant(result.tenant),
      user: sanitizeUser(result.user),
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
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
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'missing_refresh_token',
        message: 'refreshToken is required'
      });
    }

    const result = await authService.refreshSession(refreshToken, extractRequestMeta(req));

    return res.json({
      success: true,
      tenant: sanitizeTenant(result.tenant),
      user: sanitizeUser(result.user),
      tokens: {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
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
    const { refreshToken, all } = req.body || {};
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
    } else if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    } else {
      await authService.revokeAllSessions(userId);
    }

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
