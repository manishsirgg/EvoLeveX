-- Store provider attempt recovery bookkeeping. No API authorization or payment settlement.
BEGIN;
ALTER TABLE private.evo_store_provider_order_attempts
  ADD COLUMN IF NOT EXISTS reconciliation_note text,
  ADD COLUMN IF NOT EXISTS reconciliation_required_at timestamptz;
CREATE FUNCTION private.flag_evo_store_provider_attempt_uncertain(p_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE a private.evo_store_provider_order_attempts%rowtype;
BEGIN
  SELECT * INTO a FROM private.evo_store_provider_order_attempts
  WHERE attempt_id=p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_ATTEMPT_NOT_FOUND';
  END IF;
  IF a.state='prepared' THEN
    UPDATE private.evo_store_provider_order_attempts
    SET state='dispatch_uncertain',updated_at=now()
    WHERE attempt_id=p_attempt_id RETURNING * INTO a;
  ELSIF a.state NOT IN ('dispatch_uncertain','reconciliation_required') THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_ATTEMPT_CANNOT_FLAG';
  END IF;
  RETURN pg_catalog.jsonb_build_object('attempt_id',a.attempt_id,
    'state',a.state,'dispatch_allowed',false,'payment_ready',false);
END;
$body$;
CREATE FUNCTION private.require_evo_store_provider_reconciliation(p_attempt_id uuid,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE a private.evo_store_provider_order_attempts%rowtype;
BEGIN
  IF p_note IS NULL OR length(btrim(p_note))<8 OR length(p_note)>400 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_PROVIDER_RECONCILIATION_NOTE_REQUIRED';
  END IF;
  SELECT * INTO a FROM private.evo_store_provider_order_attempts
  WHERE attempt_id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR a.state NOT IN ('dispatch_uncertain','reconciliation_required') THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_RECONCILIATION_INVALID_STATE';
  END IF;
  UPDATE private.evo_store_provider_order_attempts
  SET state='reconciliation_required',
      reconciliation_required_at=coalesce(reconciliation_required_at,now()),
      reconciliation_note=p_note, updated_at=now()
  WHERE attempt_id=p_attempt_id RETURNING * INTO a;
  UPDATE private.evo_store_razorpay_intent_claims
  SET state='reconciliation_required'
  WHERE intent_id=a.intent_id AND state='reserved';
  RETURN pg_catalog.jsonb_build_object('attempt_id',a.attempt_id,
    'state',a.state,'dispatch_allowed',false,'payment_ready',false);
END;
$body$;
REVOKE ALL ON FUNCTION private.flag_evo_store_provider_attempt_uncertain(uuid)
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.require_evo_store_provider_reconciliation(uuid,text)
FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION private.flag_evo_store_provider_attempt_uncertain(uuid) IS
'Operator-only fail-closed state transition. Does not authorize provider API POST.';
COMMENT ON FUNCTION private.require_evo_store_provider_reconciliation(uuid,text) IS
'Operator-only reconciliation lock. Does not confirm or correlate provider order.';
COMMIT;
