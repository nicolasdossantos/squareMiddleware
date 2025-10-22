/**
 * Customer Context Service
 * Persists call analysis insights and retrieves contextual data
 * for future conversations.
 */

const { getPool, withTransaction } = require('./database');
const { logger, logEvent } = require('../utils/logger');

const LANGUAGE_CODE_MAP = {
  english: 'en',
  spanish: 'es',
  'brazilian portuguese': 'pt-BR',
  portuguese: 'pt',
  russian: 'ru',
  french: 'fr',
  german: 'de'
};

const CONTEXT_MAPPINGS = [
  {
    field: 'preferred_stylist',
    key: 'favorite_staff',
    valueType: 'json',
    transform: (value, analysis) => {
      if (!value) return null;
      const service = analysis?.service_interest || 'general';
      return { service, staff: value };
    }
  },
  { field: 'service_interest', key: 'service_interest', valueType: 'string' },
  { field: 'preferred_time_of_day', key: 'preferred_time', valueType: 'string' },
  { field: 'referral_source', key: 'referral_source', valueType: 'string', agentVisible: false },
  { field: 'hallucination_details', key: 'hallucination_details', valueType: 'string', agentVisible: false }
];

const AGENT_VISIBLE_CONTEXT_KEYS = new Set(['favorite_staff', 'service_interest', 'preferred_time']);

const ISSUE_PRIORITIES = {
  urgent: 'urgent',
  high: 'high',
  normal: 'normal',
  low: 'low'
};

/**
 * Normalize phone number (strip non-digits, trim country code for US numbers).
 */
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  const digits = phoneNumber.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Convert free-form language preference into ISO-style code.
 */
function normalizeLanguagePreference(language) {
  if (!language) return null;
  const normalized = String(language).trim().toLowerCase();
  return LANGUAGE_CODE_MAP[normalized] || normalized || null;
}

/**
 * Derive issue objects from call analysis payload.
 */
function deriveIssues(callAnalysis = {}) {
  const issues = [];

  if (!callAnalysis || typeof callAnalysis !== 'object') {
    return issues;
  }

  if (callAnalysis.booking_attempted && !callAnalysis.booking_completed) {
    issues.push({
      type: 'booking_incomplete',
      description: callAnalysis.booking_failure_reason || 'Booking not completed during call',
      priority: ISSUE_PRIORITIES.high
    });
  }

  if (Array.isArray(callAnalysis.unanswered_questions)) {
    for (const question of callAnalysis.unanswered_questions) {
      if (question) {
        issues.push({
          type: 'question_unanswered',
          description: question,
          priority: ISSUE_PRIORITIES.normal
        });
      }
    }
  } else if (callAnalysis.unresolved_issue) {
    issues.push({
      type: 'question_unanswered',
      description: callAnalysis.unresolved_issue,
      priority: ISSUE_PRIORITIES.normal
    });
  }

  if (callAnalysis.callback_requested) {
    issues.push({
      type: 'callback_requested',
      description: callAnalysis.callback_reason || 'Customer requested a callback',
      priority: callAnalysis.callback_urgent ? ISSUE_PRIORITIES.urgent : ISSUE_PRIORITIES.high
    });
  }

  const unique = [];
  const dedupeKey = new Set();
  for (const issue of issues) {
    const key = `${issue.type}:${issue.description}`;
    if (!dedupeKey.has(key)) {
      dedupeKey.add(key);
      unique.push(issue);
    }
  }

  return unique;
}

/**
 * Derive context entries from call analysis payload.
 */
function deriveContextEntries(callAnalysis = {}) {
  const entries = [];
  if (!callAnalysis || typeof callAnalysis !== 'object') {
    return entries;
  }

  for (const mapping of CONTEXT_MAPPINGS) {
    const rawValue = callAnalysis[mapping.field];
    const transformed = mapping.transform ? mapping.transform(rawValue, callAnalysis) : rawValue;

    if (
      transformed === undefined ||
      transformed === null ||
      transformed === '' ||
      (typeof transformed === 'object' && Object.keys(transformed).length === 0)
    ) {
      continue;
    }

    let value;
    if (mapping.valueType === 'boolean') {
      value = transformed === true || transformed === 'true' ? 'true' : 'false';
    } else if (mapping.valueType === 'json') {
      value = typeof transformed === 'string' ? transformed : JSON.stringify(transformed);
    } else {
      value = String(transformed);
    }

    entries.push({
      contextKey: mapping.key,
      value,
      valueType: mapping.valueType || 'string',
      confidence: 0.85,
      source: 'retell_post_call_analysis'
    });
  }

  return entries;
}

/**
 * Fetch customer profile by identifiers.
 */
async function findCustomerProfile(client, tenantId, { squareCustomerId, normalizedPhone }) {
  if (!tenantId) return null;

  if (squareCustomerId) {
    const bySquare = await client.query(
      'SELECT * FROM customer_profiles WHERE tenant_id = $1 AND square_customer_id = $2 LIMIT 1',
      [tenantId, squareCustomerId]
    );
    if (bySquare.rows.length > 0) {
      return bySquare.rows[0];
    }
  }

  if (normalizedPhone) {
    const byPhone = await client.query(
      'SELECT * FROM customer_profiles WHERE tenant_id = $1 AND phone_number = $2 LIMIT 1',
      [tenantId, normalizedPhone]
    );
    if (byPhone.rows.length > 0) {
      return byPhone.rows[0];
    }
  }

  return null;
}

/**
 * Create a new customer profile record.
 */
async function createCustomerProfile(
  client,
  tenantId,
  {
    squareCustomerId,
    normalizedPhone,
    email,
    firstName,
    lastName,
    preferredLanguage,
    languageConfidence,
    communicationPreference,
    callTimestamp
  }
) {
  const timestamp = callTimestamp || new Date();

  const insert = await client.query(
    `
      INSERT INTO customer_profiles (
        tenant_id,
        square_customer_id,
        phone_number,
        email,
        first_name,
        last_name,
        preferred_language,
        language_confidence,
        total_calls,
        total_bookings,
        first_call_date,
        last_call_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0.50), 0, 0, $9, $9)
      RETURNING *
    `,
    [
      tenantId,
      squareCustomerId || null,
      normalizedPhone || null,
      email || null,
      firstName || null,
      lastName || null,
      preferredLanguage || 'en',
      languageConfidence || 0.5,
      timestamp,
      timestamp
    ]
  );

  return insert.rows[0];
}

/**
 * Update existing profile with new metadata (non-metric fields).
 */
async function updateCustomerProfileMetadata(
  client,
  profileId,
  { squareCustomerId, normalizedPhone, email, firstName, lastName }
) {
  const updates = [];
  const params = [profileId];
  let index = 2;

  if (squareCustomerId) {
    updates.push(`square_customer_id = COALESCE($${index}, square_customer_id)`);
    params.push(squareCustomerId);
    index++;
  }

  if (normalizedPhone) {
    updates.push(`phone_number = COALESCE($${index}, phone_number)`);
    params.push(normalizedPhone);
    index++;
  }

  if (email) {
    updates.push(`email = COALESCE($${index}, email)`);
    params.push(email);
    index++;
  }

  if (firstName) {
    updates.push(`first_name = COALESCE($${index}, first_name)`);
    params.push(firstName);
    index++;
  }

  if (lastName) {
    updates.push(`last_name = COALESCE($${index}, last_name)`);
    params.push(lastName);
    index++;
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push('updated_at = NOW()');

  const updateSql = `
      UPDATE customer_profiles
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

  const result = await client.query(updateSql, params);
  return result.rows[0] || null;
}

/**
 * Ensure a customer profile exists, creating or updating metadata as needed.
 */
async function ensureCustomerProfile(client, tenantId, metadata) {
  const { squareCustomerId, normalizedPhone } = metadata;
  let profile = await findCustomerProfile(client, tenantId, { squareCustomerId, normalizedPhone });

  if (!profile) {
    profile = await createCustomerProfile(client, tenantId, metadata);
    return { profile, created: true };
  }

  const updated = await updateCustomerProfileMetadata(client, profile.id, metadata);
  return { profile: updated || profile, created: false };
}

/**
 * Insert or update call history for a Retell call.
 */
async function upsertCallHistory(client, tenantId, customerProfileId, callPayload, analysis) {
  const existing = await client.query('SELECT * FROM call_history WHERE retell_call_id = $1', [
    callPayload.call_id
  ]);

  const startTime =
    callPayload.start_timestamp || callPayload.metadata?.timestamp || new Date().toISOString();
  const endTime = callPayload.end_timestamp || null;
  const durationSeconds = callPayload.duration_ms
    ? Math.round(callPayload.duration_ms / 1000)
    : endTime && startTime
      ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
      : null;

  const callSummary =
    analysis.call_summary || analysis.summary || callPayload.call_summary || analysis.reason || null;
  const transcriptString =
    typeof callPayload.transcript === 'string'
      ? callPayload.transcript
      : callPayload.transcript
        ? JSON.stringify(callPayload.transcript)
        : null;

  const bookingCreated =
    analysis.booking_created || analysis.booking_completed || analysis.booking_confirmation === true || false;

  const bookingId =
    analysis.booking_id ||
    analysis.created_booking_id ||
    analysis.booking_confirmation_id ||
    callPayload.booking_id ||
    null;

  const callSuccessful =
    typeof analysis.call_successful === 'boolean'
      ? analysis.call_successful
      : callPayload.call_status === 'success';

  const detectedLanguage =
    normalizeLanguagePreference(analysis.language_preference) ||
    normalizeLanguagePreference(analysis.detected_language) ||
    null;

  const finalAgentState =
    callPayload.collected_dynamic_variables?.current_agent_state ||
    callPayload.collected_dynamic_variables?.agent_state ||
    null;

  const spamDetected = analysis.spam_detected || finalAgentState === 'identify_spam_call';

  if (existing.rows.length > 0) {
    const current = existing.rows[0];
    const update = await client.query(
      `
        UPDATE call_history
        SET
          customer_profile_id = COALESCE($2, customer_profile_id),
          tenant_id = $3,
          call_start_time = COALESCE($4, call_start_time),
          call_end_time = COALESCE($5, call_end_time),
          call_duration_seconds = COALESCE($6, call_duration_seconds),
          call_successful = COALESCE($7, call_successful),
          user_sentiment = COALESCE($8, user_sentiment),
          detected_language = COALESCE($9, detected_language),
          call_summary = COALESCE($10, call_summary),
          call_transcript = COALESCE($11, call_transcript),
          booking_created = COALESCE($12, booking_created),
          booking_id = COALESCE($13, booking_id),
          final_agent_state = COALESCE($14, final_agent_state),
          spam_detected = COALESCE($15, spam_detected),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        current.id,
        customerProfileId || null,
        tenantId,
        startTime,
        endTime,
        durationSeconds,
        callSuccessful,
        analysis.user_sentiment || null,
        detectedLanguage,
        callSummary,
        transcriptString,
        bookingCreated,
        bookingId,
        finalAgentState,
        spamDetected
      ]
    );

    return { callHistory: update.rows[0], created: false, bookingCreated };
  }

  const insert = await client.query(
    `
      INSERT INTO call_history (
        retell_call_id,
        customer_profile_id,
        tenant_id,
        call_start_time,
        call_end_time,
        call_duration_seconds,
        call_successful,
        user_sentiment,
        detected_language,
        call_summary,
        call_transcript,
        booking_created,
        booking_id,
        final_agent_state,
        spam_detected,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      RETURNING *
    `,
    [
      callPayload.call_id,
      customerProfileId || null,
      tenantId,
      startTime,
      endTime,
      durationSeconds,
      callSuccessful,
      analysis.user_sentiment || null,
      detectedLanguage,
      callSummary,
      transcriptString,
      bookingCreated,
      bookingId,
      finalAgentState,
      spamDetected
    ]
  );

  return { callHistory: insert.rows[0], created: true, bookingCreated };
}

/**
 * Update aggregate metrics on customer profile after a call.
 */
async function updateCustomerProfileMetrics(
  client,
  profile,
  { callStartTime, callSuccessful, bookingCreated, preferredLanguage, languageConfidence }
) {
  if (!profile) return null;

  const updates = [
    'total_calls = total_calls + 1',
    'last_call_date = $2',
    'first_call_date = COALESCE(first_call_date, $2)',
    'updated_at = NOW()'
  ];
  const params = [profile.id, callStartTime || new Date()];
  let index = 3;

  if (bookingCreated) {
    updates.push('total_bookings = total_bookings + 1');
  }

  if (preferredLanguage) {
    const currentLanguage = profile.preferred_language;
    let newConfidence = languageConfidence || 0.85;
    if (currentLanguage && currentLanguage === preferredLanguage) {
      const currentConfidence = Number(profile.language_confidence || 0.5);
      newConfidence = Math.min(1, Math.max(currentConfidence, newConfidence));
    } else if (currentLanguage && currentLanguage !== preferredLanguage) {
      newConfidence = Math.min(newConfidence, 0.75);
    }

    updates.push(`preferred_language = $${index}`);
    params.push(preferredLanguage);
    index++;

    updates.push(`language_confidence = $${index}`);
    params.push(newConfidence);
    index++;
  }

  const result = await client.query(
    `
      UPDATE customer_profiles
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `,
    params
  );

  return result.rows[0] || profile;
}

/**
 * Upsert conversation context entries.
 */
async function upsertConversationContext(client, customerProfileId, entries, confirmedAt) {
  if (!customerProfileId || !Array.isArray(entries) || entries.length === 0) {
    return { upserted: 0 };
  }

  let upserted = 0;
  for (const entry of entries) {
    await client.query(
      `
        INSERT INTO conversation_context (
          customer_profile_id,
          context_key,
          context_value,
          value_type,
          confidence,
          source,
          last_confirmed_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (customer_profile_id, context_key)
        DO UPDATE SET
          context_value = EXCLUDED.context_value,
          value_type = EXCLUDED.value_type,
          confidence = LEAST(1.0, GREATEST(EXCLUDED.confidence, conversation_context.confidence)),
          source = EXCLUDED.source,
          last_confirmed_at = EXCLUDED.last_confirmed_at,
          updated_at = NOW()
      `,
      [
        customerProfileId,
        entry.contextKey,
        entry.value,
        entry.valueType || 'string',
        entry.confidence || 0.75,
        entry.source || 'retell_post_call_analysis',
        confirmedAt || new Date()
      ]
    );
    upserted++;
  }

  return { upserted };
}

/**
 * Upsert open issues for a customer.
 */
async function upsertOpenIssues(client, tenantId, customerProfileId, callHistoryId, issues) {
  if (!tenantId || !customerProfileId || !Array.isArray(issues) || issues.length === 0) {
    return { created: 0, updated: 0 };
  }

  let created = 0;
  let updated = 0;

  for (const issue of issues) {
    const existing = await client.query(
      `
        SELECT id FROM open_issues
        WHERE tenant_id = $1
          AND customer_profile_id = $2
          AND status IN ('open', 'in_progress')
          AND issue_type = $3
          AND issue_description = $4
        LIMIT 1
      `,
      [tenantId, customerProfileId, issue.type, issue.description]
    );

    if (existing.rows.length > 0) {
      await client.query(
        `
          UPDATE open_issues
          SET
            call_history_id = $2,
            priority = COALESCE($3, priority),
            updated_at = NOW()
          WHERE id = $1
        `,
        [existing.rows[0].id, callHistoryId || null, issue.priority || ISSUE_PRIORITIES.normal]
      );
      updated++;
    } else {
      await client.query(
        `
          INSERT INTO open_issues (
            tenant_id,
            customer_profile_id,
            call_history_id,
            issue_type,
            issue_description,
            priority,
            status,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW(), NOW())
        `,
        [
          tenantId,
          customerProfileId,
          callHistoryId || null,
          issue.type,
          issue.description,
          issue.priority || ISSUE_PRIORITIES.normal
        ]
      );
      created++;
    }
  }

  return { created, updated };
}

/**
 * Persist Retell call analysis payload to the database.
 */
async function saveCallAnalysis({ tenant, call, correlationId }) {
  if (!tenant || !tenant.id || !call) {
    return null;
  }

  const tenantId = tenant.id;
  const analysis = call.call_analysis || {};
  const normalizedPhone = normalizePhoneNumber(call.from_number || call.customer_phone);

  if (!normalizedPhone) {
    logger.warn('customer_context_missing_phone', {
      callId: call.call_id,
      correlationId
    });
    return null;
  }

  const dynamicVars = call.retell_llm_dynamic_variables || {};
  const squareCustomerId =
    dynamicVars.customer_id ||
    dynamicVars.customerId ||
    analysis.customer_id ||
    call.square_customer_id ||
    null;

  const email =
    dynamicVars.customer_email ||
    dynamicVars.customerEmail ||
    analysis.customer_email ||
    call.customer_email ||
    null;

  const firstName =
    dynamicVars.customer_first_name ||
    dynamicVars.customerFirstName ||
    analysis.customer_first_name ||
    call.customer_first_name ||
    null;

  const lastName =
    dynamicVars.customer_last_name ||
    dynamicVars.customerLastName ||
    analysis.customer_last_name ||
    call.customer_last_name ||
    null;

  const preferredLanguage =
    normalizeLanguagePreference(analysis.language_preference || dynamicVars.preferred_language) || null;

  const callStartTime = call.start_timestamp || call.metadata?.timestamp || new Date().toISOString();

  const metrics = await withTransaction(async client => {
    const { profile, created } = await ensureCustomerProfile(client, tenantId, {
      squareCustomerId,
      normalizedPhone,
      email,
      firstName,
      lastName,
      preferredLanguage,
      languageConfidence: preferredLanguage ? 0.85 : null,
      callTimestamp: callStartTime
    });

    const {
      callHistory,
      created: callCreated,
      bookingCreated
    } = await upsertCallHistory(client, tenantId, profile ? profile.id : null, call, analysis);

    const updatedProfile = await updateCustomerProfileMetrics(client, profile, {
      callStartTime,
      callSuccessful: analysis.call_successful,
      bookingCreated: callCreated && bookingCreated,
      preferredLanguage,
      languageConfidence: preferredLanguage ? 0.9 : null
    });

    const contextEntries = deriveContextEntries(analysis);
    const issues = deriveIssues(analysis);

    const contextResult = await upsertConversationContext(
      client,
      updatedProfile ? updatedProfile.id : null,
      contextEntries,
      call.end_timestamp || callStartTime
    );

    const issuesResult = await upsertOpenIssues(
      client,
      tenantId,
      updatedProfile ? updatedProfile.id : null,
      callHistory ? callHistory.id : null,
      issues
    );

    logEvent('customer_context_call_analysis_saved', {
      correlationId,
      tenantId,
      callId: call.call_id,
      profileId: updatedProfile?.id || null,
      callHistoryId: callHistory?.id || null,
      issuesCreated: issuesResult.created,
      issuesUpdated: issuesResult.updated,
      contextUpserted: contextResult.upserted
    });

    return {
      profile: updatedProfile,
      callHistory,
      createdProfile: created,
      createdCallHistory: callCreated,
      issuesCreated: issuesResult.created,
      issuesUpdated: issuesResult.updated,
      contextUpserted: contextResult.upserted
    };
  });

  return metrics;
}

/**
 * Build dynamic variables payload from stored context.
 */
function buildDynamicVariablesFromContext(context) {
  if (!context || !context.profile) {
    return {};
  }

  const dynamicVariables = {
    is_returning_customer: context.profile.total_calls > 0 ? 'true' : 'false'
  };

  if (context.profile.preferred_language) {
    dynamicVariables.preferred_language = context.profile.preferred_language;
  }

  if (context.lastCall) {
    if (context.lastCall.call_summary) {
      dynamicVariables.last_call_summary = context.lastCall.call_summary;
    }
    if (context.lastCall.user_sentiment) {
      dynamicVariables.last_call_sentiment = context.lastCall.user_sentiment;
    }
  }

  if (context.openIssues && context.openIssues.length > 0) {
    dynamicVariables.has_open_issues = 'true';
    dynamicVariables.open_issues_json = JSON.stringify(context.openIssues);
  } else {
    dynamicVariables.has_open_issues = 'false';
  }

  if (context.contextEntries && context.contextEntries.length > 0) {
    for (const entry of context.contextEntries) {
      if (!AGENT_VISIBLE_CONTEXT_KEYS.has(entry.context_key)) {
        continue;
      }

      let value;
      if (entry.value_type === 'boolean') {
        value =
          entry.context_value === true || entry.context_value === 'true' || entry.context_value === '1'
            ? 'true'
            : 'false';
      } else if (entry.value_type === 'json') {
        value = entry.context_value;
      } else {
        value = entry.context_value;
      }

      if (entry.context_key === 'favorite_staff') {
        try {
          const parsed = typeof value === 'string' ? JSON.parse(value) : value;
          const serviceKey = parsed?.service || 'general';
          const staffValue = parsed?.staff ? String(parsed.staff) : null;
          if (staffValue) {
            dynamicVariables.favorite_staff = staffValue;
            dynamicVariables.favorite_staff_json = JSON.stringify({ [serviceKey]: staffValue });
          }
        } catch (error) {
          const fallbackValue = typeof value === 'string' ? value : JSON.stringify(value);
          dynamicVariables.favorite_staff = String(fallbackValue);
          dynamicVariables.favorite_staff_json = String(fallbackValue);
        }
        continue;
      }

      dynamicVariables[entry.context_key] = String(value);
    }
  }

  return dynamicVariables;
}

/**
 * Fetch stored context for a customer by phone number.
 */
async function getCustomerContext({ tenantId, phoneNumber, correlationId }) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!tenantId || !normalizedPhone) {
    return null;
  }

  const client = await getPool().connect();
  try {
    const profileResult = await client.query(
      `
        SELECT * FROM customer_profiles
        WHERE tenant_id = $1
          AND phone_number = $2
        LIMIT 1
      `,
      [tenantId, normalizedPhone]
    );

    if (profileResult.rows.length === 0) {
      return {
        profile: null,
        openIssues: [],
        lastCall: null,
        contextEntries: [],
        dynamicVariables: {},
        normalizedPhone
      };
    }

    const profile = profileResult.rows[0];

    const [issuesResult, lastCallResult, contextResult] = await Promise.all([
      client.query(
        `
          SELECT id, issue_type, issue_description, priority, status, created_at, updated_at, call_history_id
          FROM open_issues
          WHERE customer_profile_id = $1
            AND tenant_id = $2
            AND status IN ('open', 'in_progress')
          ORDER BY
            CASE priority
              WHEN 'urgent' THEN 1
              WHEN 'high' THEN 2
              WHEN 'normal' THEN 3
              ELSE 4
            END,
            created_at ASC
        `,
        [profile.id, tenantId]
      ),
      client.query(
        `
          SELECT id, call_summary, user_sentiment, call_successful, call_start_time, call_end_time, call_duration_seconds
          FROM call_history
          WHERE customer_profile_id = $1
          ORDER BY call_start_time DESC
          LIMIT 1
        `,
        [profile.id]
      ),
      client.query(
        `
          SELECT context_key, context_value, value_type, confidence, source, last_confirmed_at
          FROM conversation_context
          WHERE customer_profile_id = $1
          ORDER BY updated_at DESC
        `,
        [profile.id]
      )
    ]);

    const openIssues = issuesResult.rows.map(issue => ({
      id: issue.id,
      type: issue.issue_type,
      description: issue.issue_description,
      priority: issue.priority,
      status: issue.status,
      created_at: issue.created_at ? new Date(issue.created_at).toISOString() : null,
      updated_at: issue.updated_at ? new Date(issue.updated_at).toISOString() : null,
      call_history_id: issue.call_history_id
    }));

    const lastCallRow = lastCallResult.rows[0] || null;
    const lastCall = lastCallRow
      ? {
          id: lastCallRow.id,
          call_summary: lastCallRow.call_summary,
          user_sentiment: lastCallRow.user_sentiment,
          call_successful: lastCallRow.call_successful,
          call_start_time: lastCallRow.call_start_time
            ? new Date(lastCallRow.call_start_time).toISOString()
            : null,
          call_end_time: lastCallRow.call_end_time ? new Date(lastCallRow.call_end_time).toISOString() : null,
          call_duration_seconds: lastCallRow.call_duration_seconds
        }
      : null;

    const contextEntries = contextResult.rows.map(entry => ({
      context_key: entry.context_key,
      context_value: entry.context_value,
      value_type: entry.value_type,
      confidence: entry.confidence,
      source: entry.source,
      last_confirmed_at: entry.last_confirmed_at ? new Date(entry.last_confirmed_at).toISOString() : null
    }));

    const dynamicVariables = buildDynamicVariablesFromContext({
      profile,
      openIssues,
      lastCall,
      contextEntries
    });

    logEvent('customer_context_loaded', {
      correlationId,
      tenantId,
      profileId: profile.id,
      openIssues: openIssues.length,
      hasLastCall: !!lastCall,
      contextEntries: contextEntries.length
    });

    return {
      profile,
      openIssues,
      lastCall,
      contextEntries,
      dynamicVariables,
      normalizedPhone
    };
  } finally {
    client.release();
  }
}

module.exports = {
  normalizePhoneNumber,
  normalizeLanguagePreference,
  saveCallAnalysis,
  getCustomerContext,
  buildDynamicVariablesFromContext
};
