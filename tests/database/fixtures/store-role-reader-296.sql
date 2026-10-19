-- Disposable fixture only. Do NOT apply as a Supabase migration.
CREATE ROLE evo_store_role_reader_296 LOGIN PASSWORD 'disposable-reader-296'
  NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
CREATE SCHEMA test_role_reader_296;
REVOKE ALL ON SCHEMA test_role_reader_296 FROM PUBLIC;
CREATE FUNCTION test_role_reader_296.eligible(p_operator uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT EXISTS (
  SELECT 1 FROM public.user_roles ur
  JOIN public.roles r ON r.id=ur.role_id
  WHERE ur.user_id=p_operator AND r.code IN ('admin','super_admin')
 );
$body$;
REVOKE ALL ON FUNCTION test_role_reader_296.eligible(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA test_role_reader_296 TO evo_store_role_reader_296;
GRANT EXECUTE ON FUNCTION test_role_reader_296.eligible(uuid) TO evo_store_role_reader_296;
