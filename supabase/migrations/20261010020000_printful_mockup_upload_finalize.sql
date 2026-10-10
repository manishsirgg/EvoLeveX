-- PR #180: finalize an uploaded image only after a successful Storage upload.
-- No media uploads are performed by this SQL migration.
BEGIN;
CREATE FUNCTION public.complete_evo_store_printful_mockup(
  p_product_id uuid, p_printful_file_id bigint, p_storage_path text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  ledger_row record;
  image_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.code IN ('admin','super_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PRINTFUL_MEDIA_FORBIDDEN';
  END IF;
  PERFORM 1 FROM public.evo_store_products p WHERE p.id=p_product_id
    AND p.publication_status='draft'::public.evo_store_publication_status FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PRINTFUL_MEDIA_DRAFT_REQUIRED';
  END IF;
  SELECT * INTO ledger_row FROM private.evo_store_printful_mockup_ingestions
  WHERE product_id=p_product_id AND printful_file_id=p_printful_file_id FOR UPDATE;
  IF NOT FOUND OR ledger_row.storage_path IS DISTINCT FROM p_storage_path
    OR ledger_row.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PRINTFUL_MEDIA_RESERVATION_INVALID';
  END IF;
  SELECT id INTO image_id FROM public.evo_store_product_images
  WHERE product_id=p_product_id AND storage_path=p_storage_path AND is_active=false;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PRINTFUL_MEDIA_IMAGE_MISSING';
  END IF;
  -- Existing Supabase Storage upload must have inserted its object before this RPC.
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.bucket_id='evo-store-products'
      AND o.name=p_storage_path
  ) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PRINTFUL_MEDIA_OBJECT_MISSING';
  END IF;
  UPDATE private.evo_store_printful_mockup_ingestions
    SET status='verified', updated_at=now(), last_error_code=NULL WHERE id=ledger_row.id;
  UPDATE public.evo_store_product_images SET is_active=true WHERE id=image_id;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_evo_store_printful_mockup(uuid,bigint,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.complete_evo_store_printful_mockup(uuid,bigint,text)
  TO authenticated;
COMMIT;
