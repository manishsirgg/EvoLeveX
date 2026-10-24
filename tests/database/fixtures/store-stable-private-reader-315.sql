-- DISPOSABLE DATABASE TEST ONLY. NEVER APPLY TO LIVE SUPABASE.
-- Rehearses proposed stable private function name; no application activation.
CREATE ROLE evo_reader_owner_315 NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE evo_reader_login_315 LOGIN PASSWORD 'disposable-only-315' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO evo_reader_owner_315;
GRANT SELECT ON public.user_roles, public.roles TO evo_reader_owner_315;
CREATE POLICY evo_reader_owner_315_membership ON public.user_roles FOR SELECT TO evo_reader_owner_315 USING (true);
CREATE POLICY evo_reader_owner_315_roles ON public.roles FOR SELECT TO evo_reader_owner_315 USING (true);
-- In CI only, private already exists in the isolated Supabase fixture.
CREATE OR REPLACE FUNCTION private.evo_store_operator_eligible_for_reconciliation(p_operator uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
 SELECT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
 WHERE ur.user_id=p_operator AND r.code IN ('admin','super_admin'));
$body$;
REVOKE ALL ON FUNCTION private.evo_store_operator_eligible_for_reconciliation(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA private TO evo_reader_login_315;
GRANT EXECUTE ON FUNCTION private.evo_store_operator_eligible_for_reconciliation(uuid) TO evo_reader_login_315;
GRANT evo_reader_owner_315 TO postgres;
GRANT CREATE ON SCHEMA private TO evo_reader_owner_315;
ALTER FUNCTION private.evo_store_operator_eligible_for_reconciliation(uuid) OWNER TO evo_reader_owner_315;
REVOKE CREATE ON SCHEMA private FROM evo_reader_owner_315;
REVOKE evo_reader_owner_315 FROM postgres;
