-- ------------------------------------------------------------------
-- Multi-Tenant SaaS Core Schema
-- Creates foundational tables for tenants, authentication, billing,
-- QA workflow, and auditing. All objects are created idempotently so
-- the migration can be re-run safely in development environments.
-- ------------------------------------------------------------------

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------
-- Helper function to keep updated_at timestamps in sync
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------
-- Tenants
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    industry TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    default_location_id TEXT,
    phone_number TEXT,
    email TEXT,
    country TEXT,
    trial_ends_at TIMESTAMPTZ,
    qa_status TEXT DEFAULT 'not_started',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);

-- ------------------------------------------------------------------
-- Tenant Users
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    display_name TEXT,
    phone_number TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_tenant_users_role CHECK (role IN ('owner','admin','staff','qa'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_users_email ON tenant_users (tenant_id, lower(email));

-- Track tenant users updates
DROP TRIGGER IF EXISTS trg_tenant_users_updated_at ON tenant_users;
CREATE TRIGGER trg_tenant_users_updated_at
BEFORE UPDATE ON tenant_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Tenant User Sessions (refresh tokens)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_user_id UUID NOT NULL REFERENCES tenant_users (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_user_sessions_user
    ON tenant_user_sessions (tenant_user_id, expires_at);

DROP TRIGGER IF EXISTS trg_tenant_user_sessions_updated_at ON tenant_user_sessions;
CREATE TRIGGER trg_tenant_user_sessions_updated_at
BEFORE UPDATE ON tenant_user_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Voice Profiles
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    voice_key TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    temperature NUMERIC(4,2) DEFAULT 1.05,
    speaking_rate NUMERIC(4,2) DEFAULT 1.08,
    ambience TEXT DEFAULT 'professional_office',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_profiles_tenant_voice
    ON voice_profiles (tenant_id, voice_key);

DROP TRIGGER IF EXISTS trg_voice_profiles_updated_at ON voice_profiles;
CREATE TRIGGER trg_voice_profiles_updated_at
BEFORE UPDATE ON voice_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Retell Agents
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retell_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    voice_profile_id UUID REFERENCES voice_profiles (id) ON DELETE SET NULL,
    retell_agent_id TEXT NOT NULL UNIQUE,
    display_name TEXT,
    phone_number TEXT,
    api_bearer_token BYTEA,
    status TEXT NOT NULL DEFAULT 'pending_qa',
    qa_status TEXT DEFAULT 'pending',
    qa_notes TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retell_agents_tenant ON retell_agents (tenant_id, status);

DROP TRIGGER IF EXISTS trg_retell_agents_updated_at ON retell_agents;
CREATE TRIGGER trg_retell_agents_updated_at
BEFORE UPDATE ON retell_agents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Square Credentials (encrypted secrets)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS square_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    retell_agent_uuid UUID REFERENCES retell_agents (id) ON DELETE CASCADE,
    square_merchant_id TEXT NOT NULL,
    default_location_id TEXT NOT NULL,
    square_environment TEXT NOT NULL DEFAULT 'production',
    supports_seller_level_writes BOOLEAN DEFAULT FALSE,
    square_access_token BYTEA NOT NULL,
    square_refresh_token BYTEA,
    square_token_expires_at TIMESTAMPTZ,
    square_scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
    last_refreshed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, square_merchant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_square_credentials_agent
    ON square_credentials (retell_agent_uuid);

DROP TRIGGER IF EXISTS trg_square_credentials_updated_at ON square_credentials;
CREATE TRIGGER trg_square_credentials_updated_at
BEFORE UPDATE ON square_credentials
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Pending QA Agents Queue
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_qa_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    retell_agent_uuid UUID REFERENCES retell_agents (id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES tenant_users (id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES tenant_users (id) ON DELETE SET NULL,
    qa_status TEXT NOT NULL DEFAULT 'pending',
    qa_notes TEXT,
    last_tested_at TIMESTAMPTZ,
    configuration JSONB DEFAULT '{}'::JSONB,
    test_call_recording_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_pending_qa_status CHECK (qa_status IN ('pending','in_review','approved','changes_requested'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_qa_active
    ON pending_qa_agents (tenant_id)
    WHERE qa_status IN ('pending','in_review');

DROP TRIGGER IF EXISTS trg_pending_qa_agents_updated_at ON pending_qa_agents;
CREATE TRIGGER trg_pending_qa_agents_updated_at
BEFORE UPDATE ON pending_qa_agents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Subscription Plans
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    tier TEXT NOT NULL,
    monthly_price_cents INTEGER NOT NULL,
    setup_fee_cents INTEGER DEFAULT 0,
    included_minutes INTEGER NOT NULL DEFAULT 0,
    overage_rate_cents INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at
BEFORE UPDATE ON subscription_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed base plans (idempotent)
INSERT INTO subscription_plans (plan_code, name, description, tier, monthly_price_cents, setup_fee_cents, included_minutes, overage_rate_cents, metadata)
VALUES
    ('basic', 'Basic', 'Starter tier with limited analytics', 'basic', 9900, 50000, 500, 2500, '{"max_users":1,"supports_recordings":false}'::JSONB),
    ('mid', 'Growth', 'Full call logging with transcripts', 'mid', 19900, 50000, 1200, 2000, '{"max_users":3,"supports_recordings":true}'::JSONB),
    ('premium', 'Premium', 'Advanced analytics and priority support', 'premium', 39900, 100000, 2500, 1500, '{"max_users":5,"priority_support":true}'::JSONB)
ON CONFLICT (plan_code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tier = EXCLUDED.tier,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    setup_fee_cents = EXCLUDED.setup_fee_cents,
    included_minutes = EXCLUDED.included_minutes,
    overage_rate_cents = EXCLUDED.overage_rate_cents,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- ------------------------------------------------------------------
-- Subscriptions
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans (id),
    status TEXT NOT NULL DEFAULT 'trialing',
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    payment_method_status TEXT DEFAULT 'missing',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_subscriptions_status CHECK (status IN ('trialing','active','past_due','canceled','paused','incomplete'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_active
    ON subscriptions (tenant_id)
    WHERE status IN ('trialing','active','past_due');

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions (plan_id);

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Usage Records
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    included_minutes INTEGER NOT NULL DEFAULT 0,
    used_minutes INTEGER NOT NULL DEFAULT 0,
    overage_minutes INTEGER NOT NULL DEFAULT 0,
    estimated_overage_cents INTEGER NOT NULL DEFAULT 0,
    call_count INTEGER NOT NULL DEFAULT 0,
    raw_payload JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_period
    ON usage_records (tenant_id, period_start);

-- ------------------------------------------------------------------
-- Invoices
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions (id) ON DELETE SET NULL,
    stripe_invoice_id TEXT,
    amount_due_cents INTEGER NOT NULL,
    amount_paid_cents INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    invoice_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    pdf_url TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_invoices_status CHECK (status IN ('draft','open','paid','void','uncollectible','past_due'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices (tenant_id, invoice_date DESC);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------
-- Audit Events
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants (id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL,
    actor_id UUID,
    actor_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    severity TEXT DEFAULT 'info',
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events (tenant_id, created_at DESC);

-- ------------------------------------------------------------------
-- Active Subscriptions View
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT
    s.id,
    s.tenant_id,
    s.plan_id,
    s.status,
    s.trial_ends_at,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at,
    s.canceled_at,
    s.stripe_subscription_id,
    s.stripe_customer_id,
    p.plan_code,
    p.name AS plan_name,
    p.tier,
    p.monthly_price_cents,
    p.included_minutes,
    p.overage_rate_cents
FROM subscriptions s
INNER JOIN subscription_plans p ON p.id = s.plan_id
WHERE s.status IN ('trialing','active')
  AND (s.cancel_at IS NULL OR s.cancel_at > NOW());
