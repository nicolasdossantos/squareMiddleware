const crypto = require('crypto');
const { query, withTransaction, encryptSecret, decryptSecret } = require('./database');
const { logger } = require('../utils/logger');

function slugify(text) {
  return (
    text
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .substring(0, 60) || `tenant-${crypto.randomBytes(4).toString('hex')}`
  );
}

async function generateUniqueSlug(client, baseName) {
  const baseSlug = slugify(baseName);

  for (let counter = 0; ; counter += 1) {
    const candidate = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    const existing = await client.query('SELECT 1 FROM tenants WHERE slug = $1 LIMIT 1', [candidate]);

    if (existing.rows.length === 0) {
      return candidate;
    }
  }
}

async function getTenantById(tenantId) {
  if (!tenantId) {
    return null;
  }

  const { rows } = await query(
    `
      SELECT
        id,
        slug,
        business_name,
        status,
        timezone,
        default_location_id,
        qa_status,
        trial_ends_at
      FROM tenants
      WHERE id = $1
    `,
    [tenantId]
  );

  return rows[0] || null;
}

async function getTenantContext(tenantId) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return null;
  }

  const credentials = await getLatestSquareCredentials(tenantId);

  if (!credentials) {
    return {
      id: tenant.id,
      slug: tenant.slug,
      businessName: tenant.business_name,
      status: tenant.status,
      timezone: tenant.timezone,
      defaultLocationId: tenant.default_location_id,
      qaStatus: tenant.qa_status,
      trialEndsAt: tenant.trial_ends_at
    };
  }

  const accessToken = await decryptSecret(credentials.square_access_token);
  const refreshToken = credentials.square_refresh_token
    ? await decryptSecret(credentials.square_refresh_token)
    : null;

  return {
    id: tenant.id,
    slug: tenant.slug,
    businessName: tenant.business_name,
    status: tenant.status,
    timezone: tenant.timezone,
    defaultLocationId: credentials.default_location_id || tenant.default_location_id,
    qaStatus: tenant.qa_status,
    trialEndsAt: tenant.trial_ends_at,
    squareAccessToken: accessToken,
    squareRefreshToken: refreshToken,
    squareLocationId: credentials.default_location_id,
    squareMerchantId: credentials.square_merchant_id,
    squareEnvironment: credentials.square_environment,
    supportsSellerLevelWrites: credentials.supports_seller_level_writes,
    squareScopes: credentials.square_scopes,
    retellAgentId: credentials.retell_agent_id
  };
}

async function getLatestSquareCredentials(tenantId) {
  const { rows } = await query(
    `
      SELECT
        sc.*,
        ra.retell_agent_id
      FROM square_credentials sc
      LEFT JOIN retell_agents ra ON ra.id = sc.retell_agent_uuid
      WHERE sc.tenant_id = $1
      ORDER BY sc.updated_at DESC
      LIMIT 1
    `,
    [tenantId]
  );

  return rows[0] || null;
}

async function getAgentContextByRetellId(retellAgentId) {
  if (!retellAgentId) {
    return null;
  }

  const { rows } = await query(
    `
      SELECT
        ra.id AS internal_agent_id,
        ra.tenant_id,
        ra.retell_agent_id,
        ra.display_name,
        ra.status,
        ra.api_bearer_token,
        sc.square_access_token,
        sc.square_refresh_token,
        sc.square_token_expires_at,
        sc.square_scopes,
        sc.square_environment,
        sc.default_location_id,
        sc.square_merchant_id,
        sc.supports_seller_level_writes,
        t.business_name,
        t.timezone
      FROM retell_agents ra
      LEFT JOIN square_credentials sc ON sc.retell_agent_uuid = ra.id
      INNER JOIN tenants t ON t.id = ra.tenant_id
      WHERE ra.retell_agent_id = $1
      ORDER BY sc.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [retellAgentId]
  );

  const record = rows[0];
  if (!record) {
    return null;
  }

  const accessToken = record.square_access_token ? await decryptSecret(record.square_access_token) : null;
  const refreshToken = record.square_refresh_token ? await decryptSecret(record.square_refresh_token) : null;
  const bearerToken = record.api_bearer_token ? await decryptSecret(record.api_bearer_token) : null;

  return {
    tenantId: record.tenant_id,
    agentId: record.retell_agent_id,
    internalAgentId: record.internal_agent_id,
    bearerToken,
    squareAccessToken: accessToken,
    squareRefreshToken: refreshToken,
    squareTokenExpiresAt: record.square_token_expires_at,
    squareScopes: record.square_scopes,
    squareEnvironment: record.square_environment || 'production',
    squareLocationId: record.default_location_id,
    defaultLocationId: record.default_location_id,
    squareMerchantId: record.square_merchant_id,
    supportsSellerLevelWrites: record.supports_seller_level_writes,
    timezone: record.timezone,
    businessName: record.business_name
  };
}

async function createTenantWithOwner({
  businessName,
  email,
  passwordHash,
  timezone,
  industry,
  userDisplayName
}) {
  return withTransaction(async client => {
    const normalizedEmail = email.trim().toLowerCase();
    const slug = await generateUniqueSlug(client, businessName);

    const tenantInsert = await client.query(
      `
        INSERT INTO tenants (slug, business_name, industry, status, timezone, qa_status)
        VALUES ($1, $2, $3, 'pending', COALESCE($4, 'America/New_York'), 'not_started')
        RETURNING *
      `,
      [slug, businessName, industry || null, timezone]
    );

    const tenant = tenantInsert.rows[0];

    const userInsert = await client.query(
      `
        INSERT INTO tenant_users (tenant_id, email, password_hash, role, display_name)
        VALUES ($1, $2, $3, 'owner', $4)
        RETURNING *
      `,
      [tenant.id, normalizedEmail, passwordHash, userDisplayName || businessName]
    );

    const user = userInsert.rows[0];

    const plan = await client.query('SELECT id FROM subscription_plans WHERE plan_code = $1 LIMIT 1', [
      'basic'
    ]);

    if (plan.rows.length === 0) {
      throw new Error('Base subscription plan not found. Run migrations to seed plans.');
    }

    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await client.query(
      `
        INSERT INTO subscriptions (
          tenant_id,
          plan_id,
          status,
          trial_ends_at,
          current_period_start,
          current_period_end
        )
        VALUES ($1, $2, 'trialing', $3, NOW(), $4)
      `,
      [tenant.id, plan.rows[0].id, trialEnds, trialEnds]
    );

    return { tenant, user };
  });
}

async function storeSquareCredentials(
  {
    tenantId,
    internalAgentId,
    squareAccessToken,
    squareRefreshToken,
    merchantId,
    defaultLocationId,
    environment,
    supportsSellerLevelWrites,
    squareScopes,
    expiresAt
  },
  client
) {
  const executor = client || { query };
  const encryptedAccess = await encryptSecret(squareAccessToken, client);
  const encryptedRefresh = squareRefreshToken ? await encryptSecret(squareRefreshToken, client) : null;

  await executor.query(
    `
      INSERT INTO square_credentials (
        tenant_id,
        retell_agent_uuid,
        square_merchant_id,
        default_location_id,
        square_environment,
        supports_seller_level_writes,
        square_access_token,
        square_refresh_token,
        square_token_expires_at,
        square_scopes,
        last_refreshed_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      ON CONFLICT (tenant_id, square_merchant_id)
      DO UPDATE SET
        default_location_id = EXCLUDED.default_location_id,
        square_environment = EXCLUDED.square_environment,
        supports_seller_level_writes = EXCLUDED.supports_seller_level_writes,
        square_access_token = EXCLUDED.square_access_token,
        square_refresh_token = EXCLUDED.square_refresh_token,
        square_token_expires_at = EXCLUDED.square_token_expires_at,
        square_scopes = EXCLUDED.square_scopes,
        last_refreshed_at = NOW(),
        updated_at = NOW()
    `,
    [
      tenantId,
      internalAgentId || null,
      merchantId,
      defaultLocationId,
      environment || 'production',
      supportsSellerLevelWrites === true,
      encryptedAccess,
      encryptedRefresh,
      expiresAt || null,
      squareScopes || null
    ]
  );
}

async function storeAgentBearerToken(retellAgentUuid, bearerToken, client) {
  if (!retellAgentUuid || !bearerToken) {
    return;
  }

  const executor = client || { query };
  const encryptedBearerToken = await encryptSecret(bearerToken, client);

  await executor.query(
    `
      UPDATE retell_agents
      SET api_bearer_token = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [retellAgentUuid, encryptedBearerToken]
  );
}

module.exports = {
  getTenantById,
  getTenantContext,
  getAgentContextByRetellId,
  createTenantWithOwner,
  storeSquareCredentials,
  storeAgentBearerToken,
  slugify
};
