-- Disposable-only prototype. Do NOT deploy as a Supabase migration.
CREATE ROLE evo_reader_owner_313 NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE evo_reader_login_313 LOGIN PASSWORD 'disposable-only-313' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE SCHEMA test_store_private_313;
REVOKE ALL ON SCHEMA test_store_private_313 FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO evo_reader_owner_313;
GRANT SELECT ON public.user_roles, public.roles TO evo_reader_owner_313;
CREATE POLICY evo_reader_owner_313_membership ON public.user_roles
 FOR SELECT TO evo_reader_owner_313 USING (true);
CREATE POLICY evo_reader_owner_313_roles ON public.roles
 FOR SELECT TO evo_reader_owner_313 USING (true);
CREATE FUNCTION test_store_private_313.is_operator_eligible(p_operator uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
 SELECT EXISTS(SELECT 1 FROM public.user_roles ur
 JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_operator
 AND r.code IN ('admin','super_admin'));
$body$;
REVOKE ALL ON FUNCTION test_store_private_313.is_operator_eligible(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA test_store_private_313 TO evo_reader_login_313;
GRANT EXECUTE ON FUNCTION test_store_private_313.is_operator_eligible(uuid) TO evo_reader_login_313;
GRANT evo_reader_owner_313 TO postgres;
GRANT CREATE ON SCHEMA test_store_private_313 TO evo_reader_owner_313;
ALTER FUNCTION test_store_private_313.is_operator_eligible(uuid) OWNER TO evo_reader_owner_313;
REVOKE CREATE ON SCHEMA test_store_private_313 FROM evo_reader_owner_313;
REVOKE evo_reader_owner_313 FROM postgres;
