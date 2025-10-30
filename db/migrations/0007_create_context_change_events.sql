-- ------------------------------------------------------------------
-- Context Change Events (Week 9 - Customer Memory Enhancements)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS context_change_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    customer_profile_id UUID NOT NULL REFERENCES customer_profiles (id) ON DELETE CASCADE,
    context_key VARCHAR(100) NOT NULL,
    change_type VARCHAR(20) NOT NULL DEFAULT 'update',
    old_value JSONB,
    new_value JSONB,
    changed_by UUID,
    changed_by_email TEXT,
    change_source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_change_events_profile
    ON context_change_events (customer_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_change_events_tenant
    ON context_change_events (tenant_id, created_at DESC);
