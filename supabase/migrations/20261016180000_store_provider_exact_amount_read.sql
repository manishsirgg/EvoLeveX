-- PR #250: exact string serialization of verified decimal financial amount
BEGIN;
-- Existing table and grants are preserved; deploy only the function replacement.
-- Original table definition follows for review only:
/*
CREATE TABLE private.evo_store_provider_read_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 operator_user_id uuid NOT NULL REFERENCES auth.users(id),
 attempt_id uuid NOT NULL REFERENCES private.evo_store_provider_order_attempts(attempt_id),
 action text NOT NULL CHECK (action='read_attempt'),
 accessed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.evo_store_provider_read_audit FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.evo_store_provider_read_audit ENABLE ROW LEVEL SECURITY;

*/
CREATE OR REPLACE FUNCTION public.read_evo_store_provider_attempt_for_reconciliation(p_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE actor uuid := auth.uid();
        attempt private.evo_store_provider_order_attempts%rowtype;
BEGIN
 IF actor IS NULL OR NOT public.can_operate_evo_store_reconciliation() THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_RECONCILIATION_OPERATOR_DENIED';
 END IF;
 IF p_attempt_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_RECONCILIATION_ATTEMPT_REQUIRED';
 END IF;
 SELECT * INTO attempt FROM private.evo_store_provider_order_attempts
 WHERE attempt_id=p_attempt_id;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_RECONCILIATION_ATTEMPT_NOT_FOUND';
 END IF;
 INSERT INTO private.evo_store_provider_read_audit(operator_user_id,attempt_id,action)
 VALUES(actor,attempt.attempt_id,'read_attempt');
 RETURN pg_catalog.jsonb_build_object(
  'attempt_id',attempt.attempt_id,'intent_id',attempt.intent_id,
  'order_id',attempt.order_id,'provider_order_id',attempt.provider_order_id,
  'receipt',attempt.receipt,'amount',attempt.amount::text,'currency',attempt.currency,
  'state',attempt.state,'payment_ready',false);
END;
$body$;
REVOKE ALL ON FUNCTION public.read_evo_store_provider_attempt_for_reconciliation(uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.read_evo_store_provider_attempt_for_reconciliation(uuid) TO authenticated;
COMMIT;
