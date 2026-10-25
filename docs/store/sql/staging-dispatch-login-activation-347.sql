-- Manual staging-only activation template; NEVER an auto-applied migration.
-- Operator must provision a strong password using a separate secret manager
-- before running this script. No credential is read or stored here.
BEGIN;
DO $body$
DECLARE r pg_catalog.pg_roles%rowtype;
BEGIN
 IF pg_catalog.current_setting('evo.store_environment',true) IS DISTINCT FROM 'staging'
    OR pg_catalog.current_setting('evo.store_staging_login_approved',true) IS DISTINCT FROM 'yes' THEN
  RAISE EXCEPTION 'STORE_STAGING_LOGIN_NOT_APPROVED';
 END IF;
 SELECT * INTO r FROM pg_catalog.pg_roles
  WHERE rolname='evo_store_staging_claim_worker';
 IF NOT FOUND OR r.rolcanlogin
    OR r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
    OR r.rolbypassrls OR r.rolinherit THEN
  RAISE EXCEPTION 'STORE_STAGING_LOGIN_ROLE_INVALID';
 END IF;
 -- A password must already exist, set only through approved secret provisioning.
 -- pg_authid is admin-only; this script must run as a restricted DBA.
 IF NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_authid
  WHERE rolname='evo_store_staging_claim_worker'
    AND rolpassword IS NOT NULL
    AND rolpassword LIKE 'SCRAM-SHA-256$%'
 ) THEN
  RAISE EXCEPTION 'STORE_STAGING_LOGIN_CREDENTIAL_NOT_PROVISIONED';
 END IF;
 IF NOT pg_catalog.has_schema_privilege(r.oid,'private','USAGE')
    OR NOT pg_catalog.has_function_privilege(r.oid,
      'private.claim_evo_store_provider_dispatch(uuid)','EXECUTE')
    OR pg_catalog.has_table_privilege(r.oid,
      'private.evo_store_provider_order_attempts','INSERT,UPDATE,DELETE') THEN
  RAISE EXCEPTION 'STORE_STAGING_LOGIN_PRIVILEGES_INVALID';
 END IF;
END
$body$;
ALTER ROLE evo_store_staging_claim_worker LOGIN;
COMMIT;
