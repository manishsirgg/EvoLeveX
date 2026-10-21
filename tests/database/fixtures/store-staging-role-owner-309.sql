-- Disposable PostgreSQL 15/17 ONLY. Never apply to production.
CREATE ROLE evo_stage_reader_owner_309 NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE evo_stage_reader_login_309 LOGIN PASSWORD 'disposable-reader-309' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE SCHEMA test_stage_reader_309;
REVOKE ALL ON SCHEMA test_stage_reader_309 FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO evo_stage_reader_owner_309;
GRANT SELECT ON public.user_roles, public.roles TO evo_stage_reader_owner_309;
-- RLS remains enforced. Give only the dedicated NOLOGIN definer SELECT
-- visibility over role membership; neither app roles nor LOGIN inherit it.
CREATE POLICY evo_stage_reader_owner_309_user_roles_read ON public.user_roles
 FOR SELECT TO evo_stage_reader_owner_309 USING (true);
CREATE POLICY evo_stage_reader_owner_309_roles_read ON public.roles
 FOR SELECT TO evo_stage_reader_owner_309 USING (true);
CREATE FUNCTION test_stage_reader_309.eligible(p_operator uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
 SELECT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
 WHERE ur.user_id=p_operator AND r.code IN ('admin','super_admin'));
$body$;
-- Temporary owner transfer permissions required by PostgreSQL 15 and 17.
-- The disposable migration is executed as postgres; never grant this to the reader.
GRANT evo_stage_reader_owner_309 TO postgres;
GRANT CREATE ON SCHEMA test_stage_reader_309 TO evo_stage_reader_owner_309;
ALTER FUNCTION test_stage_reader_309.eligible(uuid) OWNER TO evo_stage_reader_owner_309;
REVOKE CREATE ON SCHEMA test_stage_reader_309 FROM evo_stage_reader_owner_309;
REVOKE evo_stage_reader_owner_309 FROM postgres;
REVOKE ALL ON FUNCTION test_stage_reader_309.eligible(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA test_stage_reader_309 TO evo_stage_reader_login_309;
GRANT EXECUTE ON FUNCTION test_stage_reader_309.eligible(uuid) TO evo_stage_reader_login_309;
