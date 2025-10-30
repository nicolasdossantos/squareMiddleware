-- ------------------------------------------------------------------
-- Phone Number Management (Phase 2 - Week 8)
-- ------------------------------------------------------------------

ALTER TABLE retell_agents
ADD COLUMN IF NOT EXISTS retell_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS phone_number_status TEXT,
ADD COLUMN IF NOT EXISTS phone_number_forwarding JSONB;

CREATE TABLE IF NOT EXISTS phone_number_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    retell_agent_uuid UUID REFERENCES retell_agents (id) ON DELETE SET NULL,
    retell_phone_number_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    assignment_type TEXT NOT NULL DEFAULT 'new',
    forwarding_number TEXT,
    forwarding_instructions TEXT,
    porting_requested BOOLEAN DEFAULT FALSE,
    porting_status TEXT,
    porting_notes TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_number_assignments_tenant
    ON phone_number_assignments (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_number_assignments_retell
    ON phone_number_assignments (retell_phone_number_id);

DROP TRIGGER IF EXISTS trg_phone_number_assignments_updated_at ON phone_number_assignments;
CREATE TRIGGER trg_phone_number_assignments_updated_at
BEFORE UPDATE ON phone_number_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS phone_number_porting_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES phone_number_assignments (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    carrier TEXT,
    account_number TEXT,
    pin_code TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_phone_number_porting_tasks_assignment
    ON phone_number_porting_tasks (assignment_id);
