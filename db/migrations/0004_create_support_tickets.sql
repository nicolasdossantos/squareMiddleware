-- ------------------------------------------------------------------
-- Support Tickets & Diagnostics (Phase 2 - Issue Detection)
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    call_history_id UUID REFERENCES call_history (id) ON DELETE SET NULL,
    retell_call_id TEXT,
    source TEXT DEFAULT 'retell_webhook',
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    category TEXT,
    summary TEXT,
    root_cause TEXT,
    recommendation TEXT,
    prevention TEXT,
    extra JSONB DEFAULT '{}'::JSONB,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    assigned_to UUID REFERENCES tenant_users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_support_ticket_severity CHECK (severity IN ('low','medium','high','critical')),
    CONSTRAINT chk_support_ticket_status CHECK (status IN ('open','acknowledged','in_progress','resolved','closed'))
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_status
    ON support_tickets (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_retell_call
    ON support_tickets (retell_call_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_severity
    ON support_tickets (tenant_id, severity, created_at DESC);

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Ticket Events (audit trail)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_ticket_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_details JSONB DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES tenant_users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket
    ON support_ticket_events (ticket_id, created_at DESC);

-- ------------------------------------------------------------------
-- Issue Diagnostics (LLM outputs & metadata)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
    diagnostic_model TEXT,
    prompt_version TEXT,
    raw_input JSONB,
    raw_output JSONB,
    summary TEXT,
    tokens_prompt INTEGER,
    tokens_completion INTEGER,
    cost_usd NUMERIC(10,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_diagnostics_ticket
    ON issue_diagnostics (ticket_id);
