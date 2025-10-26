/**
 * OAuth Controller
 * Handles Square OAuth callback exchanges and presents results to the user.
 */

const { decodeState, exchangeCodeForTokens, fetchSellerMetadata } = require('../services/oauthService');
const { logger } = require('../utils/logger');

/**
 * Escape HTML entities for safe rendering.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Determine if the client prefers JSON response.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function wantsJson(req) {
  const accepted = req.accepts(['text/html', 'application/json']);
  return accepted === 'application/json';
}

/**
 * Build the redirect URI that Square expects.
 * @param {import('express').Request} req
 * @returns {string}
 */
function buildRedirectUri(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}${req.baseUrl || ''}${req.path}`;
}

/**
 * Render success HTML page with token details.
 * @param {object} params
 * @returns {string}
 */
function renderSuccessPage({ agentId, environment, tokens, stateDebug, metadata }) {
  const safeAgentId = escapeHtml(agentId || 'Unknown');
  const supportsSellerLevelWrites = metadata?.supportsSellerLevelWrites === true;
  const planLabel = supportsSellerLevelWrites ? 'Seller-level (Plus/Premium)' : 'Buyer-level (Free plan)';
  const planDescription = supportsSellerLevelWrites
    ? 'Full calendar control enabled. Agent can manage all bookings for this seller.'
    : 'Limited to bookings created by your agent. Encourage the seller to upgrade to Appointments Plus or Premium for full access.';
  const defaultLocation =
    metadata?.defaultLocationId && Array.isArray(metadata?.locations)
      ? metadata.locations.find(location => location.id === metadata.defaultLocationId)
      : null;

  const sections = [
    {
      label: 'Access Token',
      value: tokens.accessToken,
      hint: 'Store securely – use as the Square API access token for this seller.'
    },
    {
      label: 'Refresh Token',
      value: tokens.refreshToken,
      hint: 'Use to generate future access tokens before the current one expires.'
    },
    {
      label: 'Expires At',
      value: tokens.expiresAt,
      hint: 'Access token expiration timestamp (ISO 8601).'
    },
    {
      label: 'Merchant ID',
      value: tokens.merchantId,
      hint: 'Unique Square merchant identifier for this seller.'
    },
    {
      label: 'Scopes',
      value: Array.isArray(tokens.scope) ? tokens.scope.join(', ') : tokens.scope,
      hint: 'Granted permissions for this authorization (comma separated).'
    }
  ];

  const tokenRows = sections
    .filter(section => section.value)
    .map(
      section => `
        <div class="token-row">
          <div class="label">${escapeHtml(section.label)}</div>
          <div class="value">${escapeHtml(section.value)}</div>
          <div class="hint">${escapeHtml(section.hint)}</div>
        </div>
      `
    )
    .join('\n');

  const debugBlock = stateDebug
    ? `<div class="debug">
          <div class="debug-title">State Payload (decoded)</div>
          <pre>${escapeHtml(JSON.stringify(stateDebug, null, 2))}</pre>
       </div>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Square OAuth Authorization Complete</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: "Square Sans", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
        background: #f6f8fa;
        color: #0f172a;
      }
      body {
        margin: 0;
        padding: 40px 16px;
        display: flex;
        justify-content: center;
      }
      .card {
        max-width: 760px;
        width: 100%;
        background: #ffffff;
        border-radius: 18px;
        box-shadow: 0 18px 48px rgba(15, 24, 61, 0.12);
        padding: 36px;
      }
      h1 {
        font-size: 28px;
        margin-bottom: 8px;
      }
      .subtitle {
        color: #475569;
        margin-bottom: 24px;
      }
      .status {
        background: linear-gradient(135deg, #38bdf8, #2563eb);
        color: #ffffff;
        padding: 18px 20px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        margin-bottom: 24px;
      }
      .status svg {
        width: 24px;
        height: 24px;
      }
      .token-row {
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 20px;
        margin-bottom: 16px;
        background: #f8fafc;
      }
      .token-row .label {
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 6px;
      }
      .token-row .value {
        font-family: "JetBrains Mono", "SFMono-Regular", "Menlo", monospace;
        word-break: break-all;
        font-size: 14px;
        color: #0f172a;
      }
      .token-row .hint {
        margin-top: 10px;
        font-size: 13px;
        color: #475569;
      }
      .note {
        margin-top: 24px;
        padding: 18px;
        border-radius: 14px;
        background: #fff7ed;
        color: #7c2d12;
      }
      .debug {
        margin-top: 24px;
        background: #0f172a;
        color: #f8fafc;
        border-radius: 14px;
        padding: 18px;
      }
      .debug-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #bae6fd;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: "JetBrains Mono", "SFMono-Regular", "Menlo", monospace;
      }
    </style>
  </head>
  <body>
    <article class="card">
      <div class="status">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" opacity="0.45" />
          <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Authorization Successful
      </div>
      <h1>Square OAuth Tokens Ready</h1>
      <p class="subtitle">
        Agent <strong>${safeAgentId}</strong> is now authorized in the Square <strong>${escapeHtml(
          environment
        )}</strong> environment.
        Store the credentials below in your secure configuration store.
      </p>
      <div class="token-row" style="background:#ecfeff;border-color:#bae6fd;">
        <div class="label">Plan Support</div>
        <div class="value">${escapeHtml(planLabel)}</div>
        <div class="hint">${escapeHtml(planDescription)}</div>
      </div>
      ${
        metadata?.displayName
          ? `<div class="token-row">
              <div class="label">Business</div>
              <div class="value">${escapeHtml(metadata.displayName)}</div>
              <div class="hint">Merchant ID: ${escapeHtml(metadata.merchantId || tokens.merchantId || 'Unknown')}</div>
            </div>`
          : ''
      }
      ${
        metadata?.defaultLocationId
          ? `<div class="token-row">
              <div class="label">Default Location</div>
              <div class="value">${escapeHtml(metadata.defaultLocationId)}</div>
              <div class="hint">${escapeHtml(
                defaultLocation?.name || 'Configured Square location for bookings'
              )}</div>
            </div>`
          : ''
      }
      ${tokenRows}
      <div class="note">
        <strong>Security reminder:</strong> Copy these credentials into your vault or encrypted configuration
        immediately. Treat them as secrets – refresh tokens never expire unless revoked. Rotate the access
        token using the refresh token before the expiration time.
      </div>
      ${debugBlock}
    </article>
  </body>
</html>`;
}

/**
 * Render error page for OAuth failures.
 * @param {object} params
 * @returns {string}
 */
function renderErrorPage({ title, message, nextSteps, stateRaw }) {
  const steps = (nextSteps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('');
  const stateSection = stateRaw
    ? `<div class="state-debug">
          <div class="state-title">Original state parameter</div>
          <code>${escapeHtml(stateRaw)}</code>
       </div>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Square OAuth Authorization Failed</title>
    <style>
      body {
        margin: 0;
        padding: 40px 16px;
        background: #0f172a;
        color: #f8fafc;
        font-family: "Square Sans", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
        display: flex;
        justify-content: center;
      }
      .card {
        max-width: 700px;
        width: 100%;
        background: #1e293b;
        border-radius: 18px;
        padding: 36px;
        box-shadow: 0 18px 48px rgba(15, 24, 61, 0.32);
      }
      h1 {
        font-size: 30px;
        margin-bottom: 12px;
        color: #fda4af;
      }
      p {
        color: #e2e8f0;
        line-height: 1.6;
      }
      ul {
        margin-top: 18px;
        padding-left: 24px;
        color: #f1f5f9;
      }
      .state-debug {
        margin-top: 24px;
        padding: 18px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.3);
        font-family: "JetBrains Mono", "SFMono-Regular", "Menlo", monospace;
        word-break: break-all;
      }
      .state-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #cbd5f5;
      }
      code {
        display: block;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <article class="card">
      <h1>${escapeHtml(title || 'Authorization Failed')}</h1>
      <p>${escapeHtml(message || 'Square returned an error during the OAuth callback.')}</p>
      ${
        steps
          ? `<h2>Next steps</h2>
      <ul>${steps}</ul>`
          : ''
      }
      ${stateSection}
    </article>
  </body>
</html>`;
}

/**
 * Handle Square OAuth callback route.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleAuthCallback(req, res) {
  const { code, state, error, error_description: errorDescription } = req.query;

  logger.info('Square OAuth callback invoked', {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    error: error || null
  });

  if (error) {
    const payload = {
      title: 'Square Authorization Declined',
      message: errorDescription || error,
      nextSteps: [
        'Verify the seller granted the requested permissions.',
        'Ensure the Square application scopes match your business needs.',
        'Retry the authorization flow from your onboarding portal.'
      ],
      stateRaw: state || null
    };

    if (wantsJson(req)) {
      return res.status(400).json({
        success: false,
        error,
        message: errorDescription || 'Square rejected the authorization request.',
        state
      });
    }

    return res.status(400).send(renderErrorPage(payload));
  }

  if (!code) {
    const missingCodeMessage = 'Missing authorization code in callback request.';
    if (wantsJson(req)) {
      return res.status(400).json({
        success: false,
        error: 'missing_code',
        message: missingCodeMessage
      });
    }

    return res.status(400).send(
      renderErrorPage({
        title: 'Authorization Code Missing',
        message: missingCodeMessage,
        nextSteps: [
          'Confirm the redirect URL matches the one configured in Square Developer Portal.',
          'Restart the OAuth flow to generate a new authorization code (codes expire after 5 minutes).'
        ],
        stateRaw: state || null
      })
    );
  }

  const stateInfo = decodeState(state);
  const stateData = stateInfo.data || {};
  const environment =
    stateData.environment ||
    stateData.squareEnvironment ||
    stateData.env ||
    process.env.SQUARE_ENVIRONMENT ||
    'sandbox';

  const redirectUri = stateData.redirectUri || stateData.redirect_uri || buildRedirectUri(req);

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId: stateData.clientId || process.env.SQUARE_APPLICATION_ID,
      clientSecret: process.env.SQUARE_APPLICATION_SECRET,
      environment,
      redirectUri
    });

    let metadata = null;
    try {
      metadata = await fetchSellerMetadata({
        accessToken: tokens.accessToken,
        environment
      });
    } catch (metadataError) {
      logger.warn('Square OAuth metadata fetch failed', {
        message: metadataError.message,
        statusCode: metadataError.statusCode
      });
    }

    const merchantId = tokens.merchantId || metadata?.merchantId || stateData.merchantId || null;
    const supportsSellerLevelWrites = metadata?.supportsSellerLevelWrites === true;
    const defaultLocationId = metadata?.defaultLocationId || stateData.locationId || null;
    const businessName = metadata?.displayName || stateData.businessName || null;
    const metadataForView = {
      merchantId,
      defaultLocationId,
      displayName: businessName,
      supportsSellerLevelWrites,
      locations: metadata?.locations || [],
      bookingProfile: metadata?.bookingProfile || null,
      timezone: metadata?.timezone || null
    };

    if (wantsJson(req)) {
      return res.json({
        success: true,
        agentId: stateData.agentId || null,
        environment,
        merchantId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        businessName,
        defaultLocationId,
        supportsSellerLevelWrites,
        bookingProfile: metadata?.bookingProfile,
        locations: metadata?.locations,
        timezone: metadata?.timezone,
        state: state
      });
    }

    return res.send(
      renderSuccessPage({
        agentId: stateData.agentId,
        environment,
        tokens,
        metadata: metadataForView,
        stateDebug: stateInfo.isDecoded ? stateData : null
      })
    );
  } catch (err) {
    logger.error('Square OAuth callback failed', {
      message: err.message,
      statusCode: err.statusCode,
      correlationId: req.correlationId
    });

    const friendlyMessage =
      err.statusCode === 400
        ? 'Square rejected the authorization code. It may be expired or already used.'
        : 'Unexpected error while exchanging the authorization code.';

    if (wantsJson(req)) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: 'token_exchange_failed',
        message: friendlyMessage,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }

    return res.status(err.statusCode || 500).send(
      renderErrorPage({
        title: 'Token Exchange Failed',
        message: friendlyMessage,
        nextSteps: [
          'Start a new OAuth authorization from your onboarding portal.',
          'Verify the Square Application ID and Secret are configured correctly.',
          'Check the server logs for more detailed error context.'
        ],
        stateRaw: stateInfo.raw
      })
    );
  }
}

module.exports = {
  handleAuthCallback
};
