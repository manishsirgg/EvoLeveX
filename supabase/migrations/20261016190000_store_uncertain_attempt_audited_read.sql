-- PR #254: admin-only, audited, read-only recovery of an uncertain Store attempt.
BEGIN;
CREATE FUNCTION public.read_evo_store_uncertain_attempt_for_reconciliation(p_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE actor uuid := auth.uid();
        attempt private.evo_store_provider_order_attempts%rowtype;
BEGIN
 IF actor IS NULL OR NOT public.can_operate_evo_store_reconciliation() THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='STORE_RECONCILIATION_OPERATOR_DENIED';
 END IF;
 IF p_attempt_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='STORE_RECONCILIATION_ATTEMPT_REQUIRED';
 END IF;
 SELECT * INTO attempt FROM private.evo_store_provider_order_attempts
 WHERE attempt_id=p_attempt_id AND state IN ('dispatch_uncertain','reconciliation_required')
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STORE_RECONCILIATION_UNCERTAIN_ATTEMPT_UNAVAILABLE';
 END IF;
 IF attempt.provider_order_id IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STORE_RECONCILIATION_ALREADY_CORRELATED';
 END IF;
 INSERT INTO private.evo_store_provider_read_audit(operator_user_id,attempt_id,action)
 VALUES(actor,attempt.attempt_id,'read_uncertain');
 RETURN pg_catalog.jsonb_build_object(
  'attempt_id',attempt.attempt_id,
  'intent_id',attempt.intent_id,
  'order_id',attempt.order_id,
  'receipt',attempt.receipt,
  'amount',attempt.amount::text,
  'currency',attempt.currency,
  'state',attempt.state,
  'provider_order_id',NULL,
  'payment_ready',false);
END;
$body$;
ALTER TABLE private.evo_store_provider_read_audit
 DROP CONSTRAINT evo_store_provider_read_audit_action_check;
ALTER TABLE private.evo_store_provider_read_audit
 ADD CONSTRAINT evo_store_provider_read_audit_action_check
 CHECK (action IN ('read_attempt','read_uncertain'));
REVOKE ALL ON FUNCTION public.read_evo_store_uncertain_attempt_for_reconciliation(uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.read_evo_store_uncertain_attempt_for_reconciliation(uuid)
 TO authenticated;
COMMENT ON FUNCTION public.read_evo_store_uncertain_attempt_for_reconciliation(uuid) IS
'Admin-only audited trusted evidence read for uncertain attempts; no provider calls, payment confirmation, or correlation mutation.';
COMMIT;
