const crypto = require('crypto');
const { withTransaction } = require('./database');
const tenantService = require('./tenantService');
const { logger } = require('../utils/logger');

async function upsertVoiceProfile(client, tenantId, preferences = {}) {
  if (!preferences?.voiceKey) {
    return null;
  }

  const voiceInsert = await client.query(
    `
      INSERT INTO voice_profiles (
        tenant_id,
        name,
        provider,
        voice_key,
        language,
        temperature,
        speaking_rate,
        ambience,
        is_default
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
      ON CONFLICT (tenant_id, voice_key)
      DO UPDATE SET
        name = EXCLUDED.name,
        provider = EXCLUDED.provider,
        language = EXCLUDED.language,
        temperature = EXCLUDED.temperature,
        speaking_rate = EXCLUDED.speaking_rate,
        ambience = EXCLUDED.ambience,
        is_default = TRUE,
        updated_at = NOW()
      RETURNING *
    `,
    [
      tenantId,
      preferences.name || preferences.voiceKey,
      preferences.provider || 'retell',
      preferences.voiceKey,
      preferences.language || 'en',
      preferences.temperature || 1.05,
      preferences.speakingRate || 1.08,
      preferences.ambience || 'professional_office'
    ]
  );

  // Ensure other profiles are not default
  await client.query(
    `
      UPDATE voice_profiles
      SET is_default = FALSE
      WHERE tenant_id = $1 AND id <> $2 AND is_default = TRUE
    `,
    [tenantId, voiceInsert.rows[0].id]
  );

  return voiceInsert.rows[0];
}

async function confirmSquareAuthorization({
  tenantId,
  retellAgentId,
  tokens,
  metadata,
  voicePreferences,
  submittedBy,
  configuration
}) {
  if (!tenantId) {
    throw new Error('tenantId is required to confirm authorization');
  }

  if (!retellAgentId) {
    throw new Error('retellAgentId is required to confirm authorization');
  }

  const transactionResult = await withTransaction(async client => {
    const voiceProfile = await upsertVoiceProfile(client, tenantId, voicePreferences);

    const agentInsert = await client.query(
      `
        INSERT INTO retell_agents (
          tenant_id,
          voice_profile_id,
          retell_agent_id,
          display_name,
          status,
          qa_status
        ) VALUES ($1,$2,$3,$4,'pending_qa','pending')
        ON CONFLICT (retell_agent_id)
        DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          voice_profile_id = COALESCE(EXCLUDED.voice_profile_id, retell_agents.voice_profile_id),
          display_name = COALESCE(EXCLUDED.display_name, retell_agents.display_name),
          status = 'pending_qa',
          qa_status = 'pending',
          updated_at = NOW()
        RETURNING *
      `,
      [tenantId, voiceProfile ? voiceProfile.id : null, retellAgentId, metadata?.displayName || null]
    );

    const agentRecord = agentInsert.rows[0];

    await client.query(
      `
        UPDATE tenants
        SET
          business_name = COALESCE($2, business_name),
          status = 'pending_qa',
          timezone = COALESCE($3, timezone),
          default_location_id = COALESCE($4, default_location_id),
          qa_status = 'pending',
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        tenantId,
        metadata?.displayName || null,
        metadata?.timezone || null,
        metadata?.defaultLocationId || null
      ]
    );

    const qaInsert = await client.query(
      `
        INSERT INTO pending_qa_agents (
          tenant_id,
          retell_agent_uuid,
          submitted_by,
          qa_status,
          configuration
        ) VALUES ($1,$2,$3,'pending',$4)
        ON CONFLICT (tenant_id)
        DO UPDATE SET
          retell_agent_uuid = EXCLUDED.retell_agent_uuid,
          qa_status = 'pending',
          configuration = EXCLUDED.configuration,
          updated_at = NOW()
        RETURNING *
      `,
      [tenantId, agentRecord.id, submittedBy || null, configuration || {}]
    );

    const bearerToken = crypto.randomBytes(32).toString('hex');

    await tenantService.storeAgentBearerToken(agentRecord.id, bearerToken, client);
    await tenantService.storeSquareCredentials(
      {
        tenantId,
        internalAgentId: agentRecord.id,
        squareAccessToken: tokens.accessToken,
        squareRefreshToken: tokens.refreshToken,
        merchantId: metadata?.merchantId || tokens.merchantId,
        defaultLocationId: metadata?.defaultLocationId || null,
        environment: metadata?.environment || tokens.environment || 'production',
        supportsSellerLevelWrites: metadata?.supportsSellerLevelWrites,
        squareScopes: Array.isArray(tokens.scope)
          ? tokens.scope
          : typeof tokens.scope === 'string'
            ? tokens.scope.split(/[ ,]+/).filter(Boolean)
            : [],
        expiresAt: tokens.expiresAt || null
      },
      client
    );

    return {
      agent: agentRecord,
      voiceProfile,
      pendingQa: qaInsert.rows[0],
      bearerToken
    };
  });

  logger.info('onboarding_square_authorization_confirmed', {
    tenantId,
    retellAgentId,
    merchantId: metadata?.merchantId || tokens.merchantId
  });

  return transactionResult;
}

async function saveVoicePreferences(tenantId, preferences = {}) {
  if (!tenantId) {
    throw new Error('tenantId is required to save voice preferences');
  }

  return withTransaction(async client => {
    const voiceProfile = await upsertVoiceProfile(client, tenantId, preferences);

    await client.query(
      `
        UPDATE tenants
        SET
          business_name = COALESCE($2, business_name),
          phone_number = COALESCE($3, phone_number),
          timezone = COALESCE($4, timezone),
          industry = COALESCE($5, industry),
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        tenantId,
        preferences.businessName || null,
        preferences.phoneNumber || null,
        preferences.timezone || null,
        preferences.industry || null
      ]
    );

    return voiceProfile;
  });
}

module.exports = {
  confirmSquareAuthorization,
  saveVoicePreferences
};
