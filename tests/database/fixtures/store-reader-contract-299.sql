-- TEST-ONLY proposed staging contract. Not a production migration.
-- No LOGIN role is provisioned; no credentials or grants exist in live Supabase.
CREATE SCHEMA test_stage_reader_299;
REVOKE ALL ON SCHEMA test_stage_reader_299 FROM PUBLIC;
CREATE FUNCTION test_stage_reader_299.eligible(p_operator uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
 SELECT EXISTS (
  SELECT 1 FROM public.user_roles ur
  JOIN public.roles r ON r.id=ur.role_id
  WHERE ur.user_id=p_operator
    AND r.code IN ('admin','super_admin')
 );
$body$;
REVOKE ALL ON FUNCTION test_stage_reader_299.eligible(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
-- No GRANT until an independently reviewed staging LOGIN and connection exist.
COMMENT ON FUNCTION test_stage_reader_299.eligible(uuid) IS
 'Disposable contract fixture only; not a payment authorization or authenticated human identity.';
