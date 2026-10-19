CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE ROLE evo_issuer_291 LOGIN PASSWORD 'disposable-issuer291' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE ROLE evo_worker_291 LOGIN PASSWORD 'disposable-worker291' NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE SCHEMA test_real_291;
REVOKE ALL ON SCHEMA test_real_291 FROM PUBLIC;
CREATE TABLE test_real_291.tickets(hash bytea PRIMARY KEY,operator_id uuid NOT NULL,attempt_id uuid NOT NULL,used boolean NOT NULL DEFAULT false);
REVOKE ALL ON test_real_291.tickets FROM PUBLIC;
CREATE FUNCTION test_real_291.allowed(p_operator uuid,p_attempt uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
 WHERE ur.user_id=p_operator AND r.code IN ('admin','super_admin'))
 AND EXISTS(SELECT 1 FROM private.evo_store_provider_order_attempts a
 WHERE a.attempt_id=p_attempt AND a.state='reconciliation_required')
$fn$;
CREATE FUNCTION test_real_291.issue(p_token text,p_operator uuid,p_attempt uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF session_user<>'evo_issuer_291' OR length(p_token)<>64 OR NOT test_real_291.allowed(p_operator,p_attempt)
 THEN RAISE EXCEPTION 'TEST_REAL_ISSUE_DENIED'; END IF;
 INSERT INTO test_real_291.tickets(hash,operator_id,attempt_id)
 VALUES(extensions.digest(decode(p_token,'hex'),'sha256'),p_operator,p_attempt);
 RETURN true;
END $fn$;
CREATE FUNCTION test_real_291.consume(p_token text,p_operator uuid,p_attempt uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_count integer;
BEGIN
 IF session_user<>'evo_worker_291' OR length(p_token)<>64 OR NOT test_real_291.allowed(p_operator,p_attempt)
 THEN RAISE EXCEPTION 'TEST_REAL_TICKET_DENIED'; END IF;
 UPDATE test_real_291.tickets SET used=true
 WHERE hash=extensions.digest(decode(p_token,'hex'),'sha256')
 AND operator_id=p_operator AND attempt_id=p_attempt AND used=false;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'TEST_REAL_TICKET_DENIED'; END IF;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION test_real_291.allowed(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION test_real_291.issue(text,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION test_real_291.consume(text,uuid,uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA test_real_291 TO evo_issuer_291,evo_worker_291;
GRANT EXECUTE ON FUNCTION test_real_291.issue(text,uuid,uuid) TO evo_issuer_291;
GRANT EXECUTE ON FUNCTION test_real_291.consume(text,uuid,uuid) TO evo_worker_291;
