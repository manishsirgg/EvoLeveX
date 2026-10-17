-- PR #262: atomic owner-only nonce + correlation. Not a client RPC.
BEGIN;
CREATE FUNCTION private.execute_evo_store_correlation_atomically(
 p_nonce text,p_operator_id uuid,p_attempt_id uuid,
 p_issued_at timestamptz,p_verified_at timestamptz,
 p_provider_order_id text,p_receipt text,p_amount numeric,p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE v_result jsonb;
BEGIN
 -- The privileged worker (not yet implemented) must authenticate the
 -- operator and independently GET provider evidence before this call.
 -- auth.uid() is a session claim and is NOT an authentication mechanism.
 IF p_operator_id IS NULL OR auth.uid() IS DISTINCT FROM p_operator_id
    OR NOT public.can_operate_evo_store_reconciliation() THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='STORE_ATOMIC_CORRELATION_OPERATOR_DENIED';
 END IF;
 -- Reservation and mutation share this transaction: a failing correlation
 -- rolls back the nonce reservation, and concurrency conflicts are serialized.
 PERFORM private.reserve_evo_store_correlation_nonce(
  p_nonce,p_operator_id,p_attempt_id,p_issued_at,p_verified_at);
 v_result := private.record_evo_store_verified_provider_correlation(
  p_attempt_id,p_provider_order_id,p_receipt,p_amount,p_currency);
 RETURN pg_catalog.jsonb_build_object(
  'attempt_id',p_attempt_id,'provider_order_id',p_provider_order_id,
  'correlated',(v_result->>'correlated')::boolean,
  'created',(v_result->>'created')::boolean,
  'payment_ready',false);
END;
$body$;
REVOKE ALL ON FUNCTION private.execute_evo_store_correlation_atomically(
 text,uuid,uuid,timestamptz,timestamptz,text,text,numeric,text)
 FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION private.execute_evo_store_correlation_atomically(
 text,uuid,uuid,timestamptz,timestamptz,text,text,numeric,text) IS
'Owner-only atomic nonce + correlation; external provider attestation and operator authentication remain worker responsibilities. Never confirms payment.';
COMMIT;
