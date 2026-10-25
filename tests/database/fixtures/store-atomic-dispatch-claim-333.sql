-- PR #333: disposable-db only. NOT a deployable Supabase migration.
-- Owner-only atomic prepared -> dispatch_uncertain claim; no HTTP dispatch.
CREATE SCHEMA IF NOT EXISTS test_store_dispatch_333;
CREATE TABLE test_store_dispatch_333.attempts(attempt_id uuid PRIMARY KEY, state text NOT NULL, updated_at timestamptz DEFAULT now());
CREATE OR REPLACE FUNCTION test_store_dispatch_333.claim_once(p_attempt_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE current_state text;
BEGIN
  IF p_attempt_id IS NULL THEN RETURN false; END IF;
  SELECT state INTO current_state
  FROM test_store_dispatch_333.attempts
  WHERE attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR current_state <> 'prepared' THEN RETURN false; END IF;
  UPDATE test_store_dispatch_333.attempts
    SET state='dispatch_uncertain', updated_at=pg_catalog.now()
    WHERE attempt_id=p_attempt_id AND state='prepared';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION test_store_dispatch_333.claim_once(uuid)
  FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON SCHEMA test_store_dispatch_333 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE test_store_dispatch_333.attempts FROM PUBLIC,anon,authenticated,service_role;
