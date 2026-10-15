-- PR #242: strict internal provider order evidence correlation; no API requests.
BEGIN;
CREATE FUNCTION private.correlate_evo_store_provider_order(
 p_attempt_id uuid,p_provider_order_id text,p_receipt text,p_amount numeric,p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE a private.evo_store_provider_order_attempts%rowtype;
        c private.evo_store_razorpay_intent_claims%rowtype;
BEGIN
 IF p_attempt_id IS NULL OR p_provider_order_id IS NULL
    OR p_provider_order_id !~ '^order_[A-Za-z0-9]{8,64}$'
    OR p_receipt IS NULL OR p_amount IS NULL OR p_currency IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_PROVIDER_EVIDENCE_INVALID';
 END IF;
 SELECT * INTO a FROM private.evo_store_provider_order_attempts
 WHERE attempt_id=p_attempt_id FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_ATTEMPT_NOT_FOUND';
 END IF;
 SELECT * INTO c FROM private.evo_store_razorpay_intent_claims
 WHERE intent_id=a.intent_id FOR UPDATE;
 IF NOT FOUND OR c.order_id IS DISTINCT FROM a.order_id
   OR c.amount IS DISTINCT FROM a.amount OR c.currency IS DISTINCT FROM a.currency THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_INTENT_MISMATCH';
 END IF;
 IF a.receipt IS DISTINCT FROM p_receipt
   OR a.amount IS DISTINCT FROM p_amount
   OR a.currency IS DISTINCT FROM p_currency THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_EVIDENCE_MISMATCH';
 END IF;
 IF a.state='correlated' THEN
  IF a.provider_order_id IS DISTINCT FROM p_provider_order_id THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_CORRELATION_CONFLICT';
  END IF;
  RETURN pg_catalog.jsonb_build_object('attempt_id',a.attempt_id,
    'provider_order_id',a.provider_order_id,'correlated',true,
    'created',false,'payment_ready',false);
 END IF;
 IF a.state NOT IN ('dispatch_uncertain','reconciliation_required') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_CORRELATION_STATE_INVALID';
 END IF;
 -- An operator must independently verify provider evidence before invoking this internal-only function.
 UPDATE private.evo_store_provider_order_attempts
 SET state='correlated',provider_order_id=p_provider_order_id,updated_at=now()
 WHERE attempt_id=a.attempt_id;
 RETURN pg_catalog.jsonb_build_object('attempt_id',a.attempt_id,
   'provider_order_id',p_provider_order_id,'correlated',true,
   'created',true,'payment_ready',false);
END;
$body$;
REVOKE ALL ON FUNCTION private.correlate_evo_store_provider_order(uuid,text,text,numeric,text)
FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION private.correlate_evo_store_provider_order(uuid,text,text,numeric,text) IS
'Internal operator-only evidence recording, NOT provider verification, dispatch permission, payment capture or fulfillment approval.';
COMMIT;
