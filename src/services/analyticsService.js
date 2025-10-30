const { query } = require('./database');
const { logger } = require('../utils/logger');

const DEFAULT_CACHE_TTL_MINUTES = parseInt(process.env.ANALYTICS_CACHE_TTL_MINUTES || '60', 10);
const PEAK_CALL_LOOKBACK_DAYS = parseInt(process.env.ANALYTICS_PEAK_CALL_DAYS || '30', 10);
const CONVERSION_LOOKBACK_DAYS = parseInt(process.env.ANALYTICS_CONVERSION_DAYS || '14', 10);
const LANGUAGE_LOOKBACK_DAYS = parseInt(process.env.ANALYTICS_LANGUAGE_DAYS || '30', 10);
const OUTCOME_LOOKBACK_DAYS = parseInt(process.env.ANALYTICS_OUTCOME_DAYS || '30', 10);

async function getCachedMetric(tenantId, metricName) {
  const { rows } = await query(
    `
      SELECT payload
      FROM call_analytics_cache
      WHERE tenant_id = $1
        AND metric_name = $2
        AND expires_at > NOW()
      ORDER BY computed_at DESC
      LIMIT 1
    `,
    [tenantId, metricName]
  );

  if (rows.length > 0) {
    return rows[0].payload;
  }
  return null;
}

async function cacheMetric(
  tenantId,
  metricName,
  payload,
  periodStart,
  periodEnd,
  ttlMinutes = DEFAULT_CACHE_TTL_MINUTES
) {
  const expiresInterval = `${Math.max(ttlMinutes, 5)} minutes`;
  await query(
    `
      INSERT INTO call_analytics_cache (
        tenant_id,
        metric_name,
        metric_period_start,
        metric_period_end,
        payload,
        computed_at,
        expires_at
      )
      VALUES ($1,$2,$3,$4,$5,NOW(), NOW() + INTERVAL '${expiresInterval}')
      ON CONFLICT (tenant_id, metric_name)
      DO UPDATE SET
        metric_period_start = EXCLUDED.metric_period_start,
        metric_period_end = EXCLUDED.metric_period_end,
        payload = EXCLUDED.payload,
        computed_at = NOW(),
        expires_at = NOW() + INTERVAL '${expiresInterval}'
    `,
    [tenantId, metricName, periodStart || null, periodEnd || null, payload]
  );
}

function getPeriodRange(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function computePeakCallTimes(tenantId) {
  const { start } = getPeriodRange(PEAK_CALL_LOOKBACK_DAYS);
  const { rows } = await query(
    `
      SELECT EXTRACT(HOUR FROM call_start_time) AS hour,
             COUNT(*) AS call_count
      FROM call_history
      WHERE tenant_id = $1
        AND call_start_time >= NOW() - INTERVAL '${PEAK_CALL_LOOKBACK_DAYS} days'
      GROUP BY hour
      ORDER BY hour
    `,
    [tenantId]
  );

  const data = Array.from({ length: 24 }, (_, hour) => ({ hour, callCount: 0 }));
  for (const row of rows) {
    const hour = Number(row.hour);
    if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
      data[hour].callCount = Number(row.call_count);
    }
  }

  return {
    timeframe: {
      start,
      end: new Date().toISOString()
    },
    data
  };
}

async function computeConversionTrend(tenantId) {
  const { start } = getPeriodRange(CONVERSION_LOOKBACK_DAYS);
  const { rows } = await query(
    `
      SELECT date_trunc('day', call_start_time) AS day,
             COUNT(*) AS total_calls,
             SUM(CASE WHEN booking_created THEN 1 ELSE 0 END) AS bookings
      FROM call_history
      WHERE tenant_id = $1
        AND call_start_time >= NOW() - INTERVAL '${CONVERSION_LOOKBACK_DAYS} days'
      GROUP BY day
      ORDER BY day
    `,
    [tenantId]
  );

  const data = rows.map(row => {
    const totalCalls = Number(row.total_calls);
    const bookings = Number(row.bookings);
    const rate = totalCalls > 0 ? bookings / totalCalls : 0;
    return {
      date: new Date(row.day).toISOString(),
      totalCalls,
      bookings,
      conversionRate: Number(rate.toFixed(4))
    };
  });

  return {
    timeframe: {
      start,
      end: new Date().toISOString()
    },
    data
  };
}

async function computeLanguageBreakdown(tenantId) {
  const { start } = getPeriodRange(LANGUAGE_LOOKBACK_DAYS);
  const { rows } = await query(
    `
      SELECT COALESCE(NULLIF(detected_language, ''), 'unknown') AS language,
             COUNT(*) AS call_count
      FROM call_history
      WHERE tenant_id = $1
        AND call_start_time >= NOW() - INTERVAL '${LANGUAGE_LOOKBACK_DAYS} days'
      GROUP BY language
      ORDER BY call_count DESC
    `,
    [tenantId]
  );

  const total = rows.reduce((sum, row) => sum + Number(row.call_count), 0);
  const data = rows.map(row => {
    const count = Number(row.call_count);
    const percentage = total > 0 ? count / total : 0;
    return {
      language: row.language,
      callCount: count,
      percentage: Number((percentage * 100).toFixed(2))
    };
  });

  return {
    timeframe: {
      start,
      end: new Date().toISOString()
    },
    totalCalls: total,
    data
  };
}

async function computeOutcomeDistribution(tenantId) {
  const { start } = getPeriodRange(OUTCOME_LOOKBACK_DAYS);
  const { rows } = await query(
    `
      SELECT CASE
               WHEN spam_detected IS TRUE THEN 'spam'
               WHEN booking_created IS TRUE THEN 'booking_created'
               WHEN call_successful IS TRUE THEN 'successful'
               WHEN call_successful IS FALSE THEN 'failed'
               WHEN final_agent_state IS NOT NULL THEN final_agent_state
               ELSE 'unknown'
             END AS outcome,
             COUNT(*) AS call_count
      FROM call_history
      WHERE tenant_id = $1
        AND call_start_time >= NOW() - INTERVAL '${OUTCOME_LOOKBACK_DAYS} days'
      GROUP BY outcome
      ORDER BY call_count DESC
    `,
    [tenantId]
  );

  const total = rows.reduce((sum, row) => sum + Number(row.call_count), 0);
  const data = rows.map(row => {
    const count = Number(row.call_count);
    const percentage = total > 0 ? count / total : 0;
    return {
      outcome: row.outcome,
      callCount: count,
      percentage: Number((percentage * 100).toFixed(2))
    };
  });

  return {
    timeframe: {
      start,
      end: new Date().toISOString()
    },
    totalCalls: total,
    data
  };
}

async function getMetricWithCache(tenantId, metricName, computeFn, periodStart, periodEnd) {
  try {
    const cached = await getCachedMetric(tenantId, metricName);
    if (cached) {
      return cached;
    }
  } catch (error) {
    logger.warn('analytics_cache_lookup_failed', {
      metricName,
      tenantId,
      error: error.message
    });
  }

  const payload = await computeFn(tenantId);

  try {
    await cacheMetric(tenantId, metricName, payload, periodStart || null, periodEnd || null);
  } catch (error) {
    logger.warn('analytics_cache_store_failed', {
      metricName,
      tenantId,
      error: error.message
    });
  }

  return payload;
}

async function getTenantAnalytics(tenantId) {
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  const peakCallTimes = await getMetricWithCache(tenantId, 'peak_call_times', computePeakCallTimes);

  const conversionTrend = await getMetricWithCache(tenantId, 'conversion_trend', computeConversionTrend);

  const languageBreakdown = await getMetricWithCache(
    tenantId,
    'language_breakdown',
    computeLanguageBreakdown
  );

  const outcomeDistribution = await getMetricWithCache(
    tenantId,
    'outcome_distribution',
    computeOutcomeDistribution
  );

  return {
    peakCallTimes,
    conversionTrend,
    languageBreakdown,
    outcomeDistribution
  };
}

module.exports = {
  getTenantAnalytics,
  // Exported for testing
  __test__: {
    computePeakCallTimes,
    computeConversionTrend,
    computeLanguageBreakdown,
    computeOutcomeDistribution,
    cacheMetric,
    getCachedMetric
  }
};
