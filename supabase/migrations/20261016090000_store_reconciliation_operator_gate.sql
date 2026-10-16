-- PR #245: narrow Store reconciliation operator authorization. No private payment data exposed.
BEGIN;
CREATE FUNCTION public.can_operate_evo_store_reconciliation()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=(SELECT auth.uid())
      AND r.code IN ('super_admin','admin')
  );
$body$;
REVOKE ALL ON FUNCTION public.can_operate_evo_store_reconciliation()
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.can_operate_evo_store_reconciliation()
  TO authenticated;
COMMENT ON FUNCTION public.can_operate_evo_store_reconciliation() IS
'Admin eligibility boolean only; no read/write rights to Store payment records or execution of private correlation.';
COMMIT;
