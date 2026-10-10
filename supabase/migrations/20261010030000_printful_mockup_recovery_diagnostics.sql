-- PR #181: read-only, administrator-gated diagnostics for interrupted POD mockup uploads.
-- No files, image rows, or ledger statuses are changed by this function.
BEGIN;
CREATE FUNCTION public.inspect_evo_store_printful_mockup_recovery(
  p_product_id uuid, p_printful_file_id bigint
) RETURNS TABLE (
  ledger_status text, image_exists boolean, image_active boolean,
  storage_exists boolean, recovery_state text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  current_row record;
  found_image record;
  object_found boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id=auth.uid() AND r.code IN ('admin','super_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PRINTFUL_MEDIA_FORBIDDEN';
  END IF;
  IF p_product_id IS NULL OR p_printful_file_id IS NULL
    OR p_printful_file_id NOT IN (1082848720,1082848721,1082848722) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PRINTFUL_MEDIA_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.evo_store_printful_product_maps m
    JOIN public.evo_store_products p ON p.id=m.product_id
    WHERE m.product_id=p_product_id AND m.sync_product_id='479728769'
      AND p.slug='printful-479728769'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PRINTFUL_MEDIA_PRODUCT_UNVERIFIED';
  END IF;
  SELECT l.* INTO current_row FROM private.evo_store_printful_mockup_ingestions l
    WHERE l.product_id=p_product_id AND l.printful_file_id=p_printful_file_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text,false,false,false,'NOT_RESERVED'::text;
    RETURN;
  END IF;
  SELECT i.id, i.is_active INTO found_image FROM public.evo_store_product_images i
    WHERE i.product_id=p_product_id AND i.storage_bucket=current_row.storage_bucket
      AND i.storage_path=current_row.storage_path;
  SELECT EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.bucket_id=current_row.storage_bucket
      AND o.name=current_row.storage_path
  ) INTO object_found;
  RETURN QUERY SELECT current_row.status::text,
    found_image.id IS NOT NULL,
    COALESCE(found_image.is_active,false),
    object_found,
    CASE
      WHEN current_row.status='verified' AND found_image.id IS NOT NULL
        AND found_image.is_active AND object_found THEN 'COMPLETE'
      WHEN current_row.status='pending' AND found_image.id IS NOT NULL
        AND NOT found_image.is_active AND object_found THEN 'PENDING_OBJECT_PRESENT'
      WHEN current_row.status='pending' AND found_image.id IS NOT NULL
        AND NOT found_image.is_active AND NOT object_found THEN 'PENDING_OBJECT_MISSING'
      ELSE 'MANUAL_REVIEW_REQUIRED'
    END::text;
END;
$$;
REVOKE ALL ON FUNCTION public.inspect_evo_store_printful_mockup_recovery(uuid,bigint)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.inspect_evo_store_printful_mockup_recovery(uuid,bigint)
  TO authenticated;
COMMIT;
