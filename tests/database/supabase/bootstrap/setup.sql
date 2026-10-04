-- This file is test-only and runs only after the Node runner validates the fixed
-- loopback target. Supabase owns auth and the API roles; preserve those schemas.
SELECT pg_catalog.set_config('evolevex.test_project', :'test_project', false);

DO $$
BEGIN
  IF current_database() <> 'postgres'
     OR current_user <> 'postgres'
     OR current_setting('evolevex.test_project', true) <> 'evolevex-p1-003'
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     OR to_regclass('auth.users') IS NULL
  THEN
    RAISE EXCEPTION 'Refusing to reset a database that is not the dedicated local Supabase test database';
  END IF;
END
$$;

DROP SCHEMA IF EXISTS private CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION pg_database_owner;
