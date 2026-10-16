-- PR #261: owner-only atomic reservation ledger; no execution authority or payment permission.
BEGIN;
CREATE TABLE private.evo_store_correlation_execution_nonces (
 nonce text PRIMARY KEY CHECK (nonce ~ '^[0-9a-f]{32,64}$'),
 operator_user_id uuid NOT NULL REFERENCES auth.users(id),
 attempt_id uuid NOT NULL REFERENCES private.evo_store_provider_order_attempts(attempt_id),
 issued_at timestamptz NOT NULL,
 verified_at timestamptz NOT NULL,
 reserved_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 CHECK (verified_at >= issued_at AND expires_at > verified_at)
);
REVOKE ALL ON private.evo_store_correlation_execution_nonces FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.evo_store_correlation_execution_nonces ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION private.reserve_evo_store_correlation_nonce(
 p_nonce text,p_operator_id uuid,p_attempt_id uuid,p_issued_at timestamptz,p_verified_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_now timestamptz := clock_timestamp();
BEGIN
 IF p_nonce IS NULL OR p_nonce !~ '^[0-9a-f]{32,64}$'
    OR p_operator_id IS NULL OR p_attempt_id IS NULL
    OR p_issued_at IS NULL OR p_verified_at IS NULL
    OR p_verified_at < p_issued_at OR p_issued_at > v_now
    OR p_verified_at > v_now OR p_verified_at <= v_now - interval '60 seconds' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_EXECUTION_NONCE_INVALID_OR_EXPIRED';
 END IF;
 IF auth.uid() IS DISTINCT FROM p_operator_id OR NOT public.can_operate_evo_store_reconciliation() THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_EXECUTION_OPERATOR_DENIED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM private.evo_store_provider_order_attempts a
  WHERE a.attempt_id=p_attempt_id AND a.state IN('dispatch_uncertain','reconciliation_required')) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_EXECUTION_ATTEMPT_UNAVAILABLE';
 END IF;
 INSERT INTO private.evo_store_correlation_execution_nonces
 (nonce,operator_user_id,attempt_id,issued_at,verified_at,expires_at)
 VALUES(p_nonce,p_operator_id,p_attempt_id,p_issued_at,p_verified_at,p_verified_at+interval '60 seconds')
 ON CONFLICT (nonce) DO NOTHING;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='STORE_EXECUTION_NONCE_REPLAYED';
 END IF;
 RETURN pg_catalog.jsonb_build_object('reserved',true,'payment_ready',false);
END;
$body$;
REVOKE ALL ON FUNCTION private.reserve_evo_store_correlation_nonce(text,uuid,uuid,timestamptz,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION private.reserve_evo_store_correlation_nonce(text,uuid,uuid,timestamptz,timestamptz) IS
'Owner-only nonce reservation; caller must independently authenticate operator and verify Razorpay evidence. Not an execution grant.';
COMMIT;
