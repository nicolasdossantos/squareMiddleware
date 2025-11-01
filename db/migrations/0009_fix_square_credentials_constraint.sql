-- Fix square_credentials constraint issue for upserts
-- This migration ensures a proper unique constraint exists on (tenant_id, square_merchant_id)
-- for use with PostgreSQL ON CONFLICT clauses

DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    -- Check if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'square_credentials') THEN

        -- Drop any existing unnamed or misnamed constraints on these columns
        BEGIN
            ALTER TABLE square_credentials DROP CONSTRAINT IF EXISTS square_credentials_tenant_id_square_merchant_id_key;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            ALTER TABLE square_credentials DROP CONSTRAINT IF EXISTS square_credentials_tenant_merchant_unique;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Ensure inline constraint from 0003 migration exists
        -- If it doesn't exist, add it
        BEGIN
            ALTER TABLE square_credentials
                ADD CONSTRAINT square_credentials_tenant_merchant_unique
                UNIQUE (tenant_id, square_merchant_id)
                DEFERRABLE INITIALLY IMMEDIATE;
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END
$$;
