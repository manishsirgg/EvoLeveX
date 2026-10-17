-- PR #274: database-side, owner-only authorization predicate scaffold.
-- No signature verification is available in this function: it MUST NOT authorize execution.
BEGIN;
CREATE FUNCTION private.can_execute_evo_store_signed_correlation(
 p_proof_payload text,p_proof_signature text,p_operator_id uuid,p_attempt_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
BEGIN
 -- PostgreSQL does not natively verify the Node Ed25519 payload format here.
 -- Fail closed regardless of inputs until an audited signature verifier and
 -- transaction-local independently authenticated operator binding exist.
 RETURN false;
END;
$body$;
REVOKE ALL ON FUNCTION private.can_execute_evo_store_signed_correlation(text,text,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION private.can_execute_evo_store_signed_correlation(text,text,uuid,uuid) IS
'Always false, owner-only placeholder: no signature attestation, actor identity, nonce consumption or correlation authority.';
COMMIT;
