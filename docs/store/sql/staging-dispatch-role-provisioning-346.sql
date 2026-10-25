-- Staging-only operator-reviewed provisioning TEMPLATE.
-- DO NOT apply as an automatic Supabase migration or to production.
-- Connect as a database administrator on a disposable/staging database only.
-- Password must be set outside version control by dedicated secret manager.
BEGIN;
DO $$
BEGIN
 IF current_setting('evo.store_staging_provisioning_approved',true) IS DISTINCT FROM 'yes'
    OR current_setting('evo.store_environment',true) IS DISTINCT FROM 'staging' THEN
  RAISE EXCEPTION 'STORE_STAGING_ROLE_PROVISIONING_NOT_APPROVED';
 END IF;
END $$;
-- This role is NOLOGIN until administrator approves separate credential setup.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='evo_store_staging_claim_worker') THEN
  CREATE ROLE evo_store_staging_claim_worker NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
REVOKE ALL ON SCHEMA private FROM evo_store_staging_claim_worker;
GRANT USAGE ON SCHEMA private TO evo_store_staging_claim_worker;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM evo_store_staging_claim_worker;
GRANT EXECUTE ON FUNCTION private.claim_evo_store_provider_dispatch(uuid) TO evo_store_staging_claim_worker;
COMMIT;
