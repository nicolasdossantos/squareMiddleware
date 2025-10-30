const { query } = require('./database');
const { logger } = require('../utils/logger');

const DEFAULT_PROFILE_LIMIT = parseInt(process.env.CUSTOMER_MEMORY_PROFILE_LIMIT || '50', 10);

async function listProfiles(tenantId, { search, limit } = {}) {
  const sqlParts = [
    `SELECT id, square_customer_id, phone_number, email, first_name, last_name, preferred_language,
            total_calls, total_bookings, last_call_date
     FROM customer_profiles
     WHERE tenant_id = $1`
  ];
  const values = [tenantId];

  if (search) {
    sqlParts.push(
      `AND (
          phone_number ILIKE $2 OR
          email ILIKE $2 OR
          first_name ILIKE $2 OR
          last_name ILIKE $2
        )`
    );
    values.push(`%${search}%`);
  }

  sqlParts.push('ORDER BY last_call_date DESC NULLS LAST, first_name ASC');
  sqlParts.push('LIMIT $' + (values.length + 1));
  values.push(Math.min(limit || DEFAULT_PROFILE_LIMIT, DEFAULT_PROFILE_LIMIT * 2));

  const { rows } = await query(sqlParts.join('\n'), values);
  return rows;
}

async function getProfileDetail(tenantId, profileId) {
  const [{ rows: profileRows }, { rows: contextRows }, { rows: issueRows }, { rows: changeRows }] =
    await Promise.all([
      query(`SELECT * FROM customer_profiles WHERE tenant_id = $1 AND id = $2 LIMIT 1`, [
        tenantId,
        profileId
      ]),
      query(
        `SELECT id, context_key, context_value, value_type, confidence, source, last_confirmed_at, created_at, updated_at
       FROM conversation_context
       WHERE customer_profile_id = $1
       ORDER BY context_key ASC`,
        [profileId]
      ),
      query(
        `SELECT id, issue_type, issue_description, priority, status, created_at
       FROM open_issues
       WHERE customer_profile_id = $1
         AND tenant_id = $2
       ORDER BY created_at DESC`,
        [profileId, tenantId]
      ),
      query(
        `SELECT id, context_key, change_type, old_value, new_value, changed_by, changed_by_email, change_source, created_at
       FROM context_change_events
       WHERE customer_profile_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
        [profileId]
      )
    ]);

  if (profileRows.length === 0) {
    return null;
  }

  return {
    profile: profileRows[0],
    context: contextRows,
    openIssues: issueRows,
    changeLog: changeRows
  };
}

async function upsertContextEntry({
  tenantId,
  profileId,
  key,
  value,
  valueType = 'string',
  confidence,
  source,
  user
}) {
  const { rows: existing } = await query(
    `SELECT context_value FROM conversation_context WHERE customer_profile_id = $1 AND context_key = $2`,
    [profileId, key]
  );

  const oldValue = existing.length > 0 ? existing[0].context_value : null;

  const upsertResult = await query(
    `
      INSERT INTO conversation_context (
        customer_profile_id, context_key, context_value, value_type, confidence, source, last_confirmed_at
      ) VALUES ($1,$2,$3,$4,$5,COALESCE($6, 'manual'), NOW())
      ON CONFLICT (customer_profile_id, context_key)
      DO UPDATE SET
        context_value = EXCLUDED.context_value,
        value_type = EXCLUDED.value_type,
        confidence = EXCLUDED.confidence,
        source = EXCLUDED.source,
        last_confirmed_at = EXCLUDED.last_confirmed_at,
        updated_at = NOW()
      RETURNING id, context_value
    `,
    [profileId, key, value, valueType, confidence || null, source]
  );

  await query(
    `
      INSERT INTO context_change_events (
        tenant_id,
        customer_profile_id,
        context_key,
        change_type,
        old_value,
        new_value,
        changed_by,
        changed_by_email,
        change_source
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)
    `,
    [
      tenantId,
      profileId,
      key,
      existing.length === 0 ? 'create' : 'update',
      oldValue ? JSON.stringify(oldValue) : null,
      JSON.stringify(value),
      user?.id || null,
      user?.email || null,
      source || 'manual'
    ]
  );

  logger.info('customer_memory_context_upserted', {
    tenantId,
    profileId,
    key
  });

  return upsertResult.rows[0];
}

async function deleteContextEntry({ tenantId, profileId, key, user }) {
  const { rows } = await query(
    `DELETE FROM conversation_context
     WHERE customer_profile_id = $1 AND context_key = $2
     RETURNING context_value`,
    [profileId, key]
  );

  if (rows.length > 0) {
    await query(
      `INSERT INTO context_change_events (
         tenant_id,
         customer_profile_id,
         context_key,
         change_type,
         old_value,
         changed_by,
         changed_by_email,
         change_source
       ) VALUES ($1,$2,$3,'delete',$4::jsonb,$5,$6,'manual')`,
      [tenantId, profileId, key, JSON.stringify(rows[0].context_value), user?.id || null, user?.email || null]
    );
  }

  return rows.length > 0;
}

module.exports = {
  listProfiles,
  getProfileDetail,
  upsertContextEntry,
  deleteContextEntry
};
