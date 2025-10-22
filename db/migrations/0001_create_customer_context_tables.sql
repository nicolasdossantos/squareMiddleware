-- Enable UUID generation (pgcrypto provides gen_random_uuid in Azure)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------
-- Customer profiles (persistent customer memory)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    square_customer_id VARCHAR(255),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    preferred_language VARCHAR(10) DEFAULT 'en',
    language_confidence NUMERIC(3,2) DEFAULT 0.50,
    total_calls INTEGER DEFAULT 0,
    total_bookings INTEGER DEFAULT 0,
    first_call_date TIMESTAMPTZ,
    last_call_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_tenant_phone
    ON customer_profiles (tenant_id, phone_number)
    WHERE phone_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_tenant_square
    ON customer_profiles (tenant_id, square_customer_id)
    WHERE square_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_last_call
    ON customer_profiles (tenant_id, last_call_date DESC);

-- ------------------------------------------------------------------
-- Call history (detailed call records)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retell_call_id VARCHAR(255) UNIQUE NOT NULL,
    customer_profile_id UUID REFERENCES customer_profiles (id) ON DELETE SET NULL,
    tenant_id VARCHAR(255) NOT NULL,
    call_start_time TIMESTAMPTZ NOT NULL,
    call_end_time TIMESTAMPTZ,
    call_duration_seconds INTEGER,
    call_successful BOOLEAN,
    user_sentiment VARCHAR(20),
    detected_language VARCHAR(10),
    call_summary TEXT,
    call_transcript TEXT,
    booking_created BOOLEAN DEFAULT FALSE,
    booking_id VARCHAR(255),
    sms_sent BOOLEAN DEFAULT FALSE,
    final_agent_state VARCHAR(50),
    spam_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_history_customer
    ON call_history (customer_profile_id, call_start_time DESC);

CREATE INDEX IF NOT EXISTS idx_call_history_tenant
    ON call_history (tenant_id, call_start_time DESC);

-- ------------------------------------------------------------------
-- Open issues (follow-up tasks)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS open_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_profile_id UUID REFERENCES customer_profiles (id) ON DELETE SET NULL,
    call_history_id UUID REFERENCES call_history (id) ON DELETE SET NULL,
    tenant_id VARCHAR(255) NOT NULL,
    issue_type VARCHAR(50) NOT NULL,
    issue_description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'open',
    resolved_at TIMESTAMPTZ,
    resolved_by_call_id UUID REFERENCES call_history (id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_open_issues_customer_status
    ON open_issues (customer_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_open_issues_tenant_status
    ON open_issues (tenant_id, status, created_at DESC);

-- ------------------------------------------------------------------
-- Conversation context (key-value preferences)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_profile_id UUID REFERENCES customer_profiles (id) ON DELETE CASCADE,
    context_key VARCHAR(100) NOT NULL,
    context_value TEXT NOT NULL,
    value_type VARCHAR(20) DEFAULT 'string',
    confidence NUMERIC(3,2) DEFAULT 0.50,
    source VARCHAR(50),
    last_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (customer_profile_id, context_key)
);

CREATE INDEX IF NOT EXISTS idx_conversation_context_customer
    ON conversation_context (customer_profile_id, context_key);
