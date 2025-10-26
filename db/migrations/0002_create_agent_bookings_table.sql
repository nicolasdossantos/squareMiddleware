-- ------------------------------------------------------------------
-- Agent-managed bookings ledger
-- Tracks Square bookings created by middleware agents so that
-- free-tier sellers can be restricted to their own bookings and
-- upcoming bookings can be surfaced quickly.
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_bookings (
    booking_id VARCHAR(255) PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    location_id VARCHAR(255),
    merchant_id VARCHAR(255),
    booking_start TIMESTAMPTZ,
    booking_status VARCHAR(50),
    booking_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_bookings_agent
    ON agent_bookings (agent_id, booking_start DESC);

CREATE INDEX IF NOT EXISTS idx_agent_bookings_merchant
    ON agent_bookings (merchant_id, booking_start DESC);

CREATE INDEX IF NOT EXISTS idx_agent_bookings_location
    ON agent_bookings (location_id, booking_start DESC);

-- Trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_agent_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_bookings_updated_at ON agent_bookings;
CREATE TRIGGER trg_agent_bookings_updated_at
BEFORE UPDATE ON agent_bookings
FOR EACH ROW
EXECUTE PROCEDURE update_agent_bookings_updated_at();
