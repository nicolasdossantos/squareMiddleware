/**
 * Azure Function: issue-diagnostics
 *
 * Receives failed call payloads from the Express app, runs GPT-powered diagnostics,
 * and persists support tickets + diagnostic metadata in PostgreSQL.
 */

const { Pool } = require('pg');
const { OpenAI } = require('openai');

let pool = null;
let openaiClient = null;

function getCorrelationId(req) {
  return (
    req.headers?.['x-correlation-id'] ||
    req.headers?.['x_correlation_id'] ||
    req.headers?.['x-correlationid'] ||
    req.body?.correlationId ||
    null
  );
}

function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString =
    process.env.PG_CONNECTION_STRING || process.env.POSTGRES_CONNECTION_STRING || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('PG_CONNECTION_STRING (or equivalent) is required for issue diagnostics');
  }

  pool = new Pool({
    connectionString,
    max: parseInt(process.env.PG_POOL_MAX || '5', 10),
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT_MS || '30000', 10)
  });

  return pool;
}

function getOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  return openaiClient;
}

function normalizeAnalysis(analysis = {}) {
  if (Array.isArray(analysis)) {
    // Convert array of { name, value } pairs to object
    return analysis.reduce((acc, item) => {
      if (item?.name) {
        acc[item.name] = item.value;
      }
      return acc;
    }, {});
  }
  return analysis;
}

function inferSeverity(analysis = {}) {
  if (analysis.escalation_needed === true || analysis.escalation_needed === 'true') {
    return 'high';
  }
  if (analysis.hallucination_detected) {
    return 'critical';
  }
  if (analysis.call_successful === false || analysis.booking_created === false) {
    return 'high';
  }
  return 'medium';
}

function buildPrompt({ transcript, analysis, callSummary, tenant, metadata }) {
  const instructions = `
You are assisting a human operator by reviewing AI receptionist phone calls.
You must:
1. Determine the core issue the AI encountered.
2. Explain the likely root cause.
3. Recommend an actionable fix.
4. Suggest a prevention strategy.
Respond in strict JSON with keys: summary, category, severity, root_cause, recommendation, prevention.
Allowed severity values: "low", "medium", "high", "critical".
Use short sentences (max 25 words per field).
`;

  const payload = {
    tenant: tenant ? { id: tenant.id, businessName: tenant.businessName } : null,
    callSummary: callSummary || null,
    analysis,
    metadata,
    transcript: transcript ? transcript.slice(0, 4000) : null
  };

  return { instructions, payload };
}

async function runDiagnostics(context, { transcript, analysis, callSummary, tenant, metadata }) {
  const client = getOpenAIClient();

  if (!client || !process.env.OPENAI_API_KEY) {
    context.log.warn('OPENAI_API_KEY not configured; skipping LLM diagnostics');
    return null;
  }

  const model = process.env.OPENAI_ISSUE_MODEL || 'gpt-4o-mini';
  const temperature = parseFloat(process.env.OPENAI_ISSUE_TEMPERATURE || '0.0');
  const { instructions, payload } = buildPrompt({ transcript, analysis, callSummary, tenant, metadata });

  const messages = [
    {
      role: 'system',
      content: instructions
    },
    {
      role: 'user',
      content: JSON.stringify(payload, null, 2)
    }
  ];

  const response = await client.chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages
  });

  const choice = response?.choices?.[0]?.message?.content;
  if (!choice) {
    throw new Error('OpenAI response missing content');
  }

  let parsed = null;
  try {
    parsed = JSON.parse(choice);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI JSON response: ${error.message}`);
  }

  return {
    parsed,
    raw: response,
    usage: response.usage || null,
    model
  };
}

module.exports = async function (context, req) {
  const correlationId = getCorrelationId(req);

  context.log('issue-diagnostics function invoked', {
    correlationId
  });

  try {
    const {
      tenantId,
      callId,
      callHistoryId,
      transcript,
      analysis: rawAnalysis,
      callSummary,
      metadata,
      source = 'retell_webhook'
    } = req.body || {};
    const tenantInfo = req.body?.tenant || null;

    if (!tenantId || !callId) {
      context.res = {
        status: 400,
        body: {
          success: false,
          error: 'tenantId and callId are required'
        }
      };
      return;
    }

    const analysis = normalizeAnalysis(rawAnalysis);
    const inferredSeverity = inferSeverity(analysis);
    const poolInstance = getPool();
    const client = await poolInstance.connect();

    let diagnostics = null;
    try {
      diagnostics = await runDiagnostics(context, {
        transcript,
        analysis,
        callSummary,
        tenant: tenantInfo,
        metadata
      });
    } catch (diagError) {
      context.log.error('Diagnostics failed; proceeding with fallback ticket creation', {
        error: diagError.message,
        correlationId
      });
    }

    const summary =
      diagnostics?.parsed?.summary ||
      callSummary ||
      'Issue detected during AI receptionist call. Review diagnostics for details.';
    const category = diagnostics?.parsed?.category || analysis?.failure_reason || 'unknown';
    const severity = diagnostics?.parsed?.severity || inferredSeverity;
    const rootCause = diagnostics?.parsed?.root_cause || null;
    const recommendation = diagnostics?.parsed?.recommendation || null;
    const prevention = diagnostics?.parsed?.prevention || null;

    const extra = {
      analysis,
      metadata,
      transcriptExcerpt: transcript ? transcript.slice(0, 2000) : null,
      diagnosticSource: diagnostics ? 'openai' : 'fallback',
      correlationId,
      tenant: tenantInfo
    };

    try {
      await client.query('BEGIN');

      const ticketInsert = `
        INSERT INTO support_tickets (
          tenant_id,
          call_history_id,
          retell_call_id,
          source,
          severity,
          status,
          category,
          summary,
          root_cause,
          recommendation,
          prevention,
          extra
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `;

      const ticketResult = await client.query(ticketInsert, [
        tenantId,
        callHistoryId || null,
        callId,
        source,
        severity,
        'open',
        category,
        summary,
        rootCause,
        recommendation,
        prevention,
        extra
      ]);

      const ticket = ticketResult.rows[0];

      const eventInsert = `
        INSERT INTO support_ticket_events (
          ticket_id,
          event_type,
          event_details,
          created_at
        ) VALUES ($1,$2,$3,NOW())
      `;
      await client.query(eventInsert, [
        ticket.id,
        'ticket_created',
        {
          severity,
          category,
          correlationId
        }
      ]);

      if (diagnostics) {
        const diagInsert = `
          INSERT INTO issue_diagnostics (
            ticket_id,
            diagnostic_model,
            prompt_version,
            raw_input,
            raw_output,
            summary,
            tokens_prompt,
            tokens_completion,
            cost_usd
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `;

        const usage = diagnostics.usage || {};
        const costUsd =
          usage.total_tokens && process.env.OPENAI_ISSUE_COST_PER_1K
            ? (usage.total_tokens / 1000) * parseFloat(process.env.OPENAI_ISSUE_COST_PER_1K)
            : null;

        const rawOutput = diagnostics.raw ? JSON.parse(JSON.stringify(diagnostics.raw)) : null;

        await client.query(diagInsert, [
          ticket.id,
          diagnostics.model,
          process.env.OPENAI_ISSUE_PROMPT_VERSION || 'v1',
          {
            transcript: transcript ? transcript.slice(0, 4000) : null,
            analysis,
            callSummary,
            metadata
          },
          rawOutput,
          diagnostics.parsed?.summary || summary,
          usage.prompt_tokens || null,
          usage.completion_tokens || null,
          costUsd
        ]);
      }

      await client.query('COMMIT');

      context.log('Support ticket created', {
        ticketId: ticket.id,
        tenantId,
        severity,
        category,
        correlationId
      });

      context.res = {
        status: 200,
        body: {
          success: true,
          ticketId: ticket.id,
          severity,
          category,
          summary,
          recommendation,
          prevention,
          tenantId,
          correlationId
        }
      };
    } catch (dbError) {
      await client.query('ROLLBACK');
      context.log.error('Failed to persist support ticket', {
        error: dbError.message,
        correlationId
      });
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    context.log.error('issue-diagnostics function failed', {
      message: error.message,
      stack: error.stack,
      correlationId
    });

    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message,
        correlationId
      }
    };
  }
};
