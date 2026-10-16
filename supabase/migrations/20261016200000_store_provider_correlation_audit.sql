-- Owner-only Store provider correlation audit. Not an exposed payment API.
BEGIN;
CREATE TABLE private.evo_store_provider_correlation_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 attempt_id uuid NOT NULL REFERENCES private.evo_store_provider_order_attempts(attempt_id),
 operator_user_id uuid NOT NULL REFERENCES auth.users(id),
 provider_order_id text NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('created','idempotent')),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.evo_store_provider_correlation_audit FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.evo_store_provider_correlation_audit ENABLE ROW LEVEL SECURITY;

-- Only database owner can execute this function. External evidence authenticity
-- cannot be established inside PostgreSQL; the future trusted server workflow
-- must verify Razorpay GET separately before invoking this owner-only boundary.
CREATE FUNCTION private.record_evo_store_verified_provider_correlation(
 p_attempt_id uuid,p_provider_order_id text,p_receipt text,p_amount numeric,p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE actor uuid := auth.uid();
        result jsonb;
BEGIN
 IF actor IS NULL OR NOT public.can_operate_evo_store_reconciliation() THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_CORRELATION_OPERATOR_DENIED';
 END IF;
 -- Existing function acquires attempt and claim row locks, checks identity,
 -- idempotency and conflicting provider IDs. Its output is never payment-ready.
 result := private.correlate_evo_store_provider_order(
  p_attempt_id,p_provider_order_id,p_receipt,p_amount,p_currency);
 INSERT INTO private.evo_store_provider_correlation_audit(
  attempt_id,operator_user_id,provider_order_id,outcome)
 VALUES(p_attempt_id,actor,p_provider_order_id,
   CASE WHEN (result->>'created')::boolean THEN 'created' ELSE 'idempotent' END);
 RETURN pg_catalog.jsonb_build_object(
  'attempt_id',p_attempt_id,'provider_order_id',p_provider_order_id,
  'correlated',true,'created',(result->>'created')::boolean,'payment_ready',false);
END;
$body$;
REVOKE ALL ON FUNCTION private.record_evo_store_verified_provider_correlation(uuid,text,text,numeric,text)
 FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION private.record_evo_store_verified_provider_correlation(uuid,text,text,numeric,text) IS
'Owner-only operator-attributed ledger for already independently verified evidence; not callable by client JWT, not payment confirmation.';
COMMIT;
