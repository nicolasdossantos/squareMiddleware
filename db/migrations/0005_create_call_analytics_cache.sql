-- ------------------------------------------------------------------
-- Call Analytics Cache (Phase 2 - Analytics & Insights)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS call_analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_period_start TIMESTAMPTZ,
    metric_period_end TIMESTAMPTZ,
    payload JSONB NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_call_analytics_tenant_metric
    ON call_analytics_cache (tenant_id, metric_name);

CREATE INDEX IF NOT EXISTS idx_call_analytics_expires
    ON call_analytics_cache (expires_at);
