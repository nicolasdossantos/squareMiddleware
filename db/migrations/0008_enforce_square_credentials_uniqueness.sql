-- Ensure square_credentials supports upserts relying on (tenant_id, square_merchant_id)
DO $$
BEGIN
    ALTER TABLE square_credentials
        ADD CONSTRAINT square_credentials_tenant_merchant_unique
            UNIQUE (tenant_id, square_merchant_id);
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END
$$;

-- Guarantee unique retell_agent_uuid values while ignoring NULLs
CREATE UNIQUE INDEX IF NOT EXISTS uq_square_credentials_agent
    ON square_credentials (retell_agent_uuid)
    WHERE retell_agent_uuid IS NOT NULL;
