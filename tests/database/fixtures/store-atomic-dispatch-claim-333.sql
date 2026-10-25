-- PR #333: disposable-db only. NOT a deployable Supabase migration.
-- Owner-only atomic prepared -> dispatch_uncertain claim; no HTTP dispatch.
CREATE OR REPLACE FUNCTION private.test_claim_evo_store_provider_dispatch_333(p_attempt_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE current_state text;
BEGIN
  IF p_attempt_id IS NULL THEN RETURN false; END IF;
  SELECT state INTO current_state
  FROM private.evo_store_provider_order_attempts
  WHERE attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR current_state <> 'prepared' THEN RETURN false; END IF;
  UPDATE private.evo_store_provider_order_attempts
    SET state='dispatch_uncertain', updated_at=pg_catalog.now()
    WHERE attempt_id=p_attempt_id AND state='prepared';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION private.test_claim_evo_store_provider_dispatch_333(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
