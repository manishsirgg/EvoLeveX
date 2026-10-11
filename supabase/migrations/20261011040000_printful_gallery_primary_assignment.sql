-- PR #195: explicit, administrator-only gallery finalization. Installing this
-- migration does NOT change image rows; call the RPC after production checks.
BEGIN;
CREATE FUNCTION public.finalize_evo_store_printful_gallery()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target_product CONSTANT uuid := '1dc06ef8-9a2e-419f-9bc3-d3ec06c476e0';
  total_images integer;
  ready_images integer;
  total_variants integer;
  active_variants integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid() AND r.code IN ('admin','super_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PRINTFUL_GALLERY_ADMIN_REQUIRED';
  END IF;

  -- Serialize with product publication and image operations.
  PERFORM 1 FROM public.evo_store_products p
  WHERE p.id=target_product
    AND p.slug='printful-479728769'
    AND p.publication_status='draft'::public.evo_store_publication_status
    AND p.is_active=false
    AND EXISTS (SELECT 1 FROM private.evo_store_printful_product_maps m
      WHERE m.product_id=p.id AND m.sync_product_id='479728769')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRINTFUL_GALLERY_DRAFT_REQUIRED';
  END IF;

  SELECT count(*),count(*) FILTER (WHERE v.is_active)
    INTO total_variants,active_variants
  FROM public.evo_store_variants v WHERE v.product_id=target_product;
  IF total_variants <> 18 OR active_variants <> 0 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRINTFUL_GALLERY_VARIANTS_UNSAFE';
  END IF;

  -- Protect against unknown image rows, duplicate metadata, unfinished ledgers,
  -- missing Storage objects and invalid file-to-image associations.
  SELECT count(*) INTO total_images
  FROM public.evo_store_product_images i
  WHERE i.product_id=target_product;
  IF total_images <> 3 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRINTFUL_GALLERY_IMAGE_COUNT_INVALID';
  END IF;

  SELECT count(*) INTO ready_images
  FROM private.evo_store_printful_mockup_ingestions l
  JOIN public.evo_store_product_images i
    ON i.product_id=l.product_id AND i.storage_path=l.storage_path
      AND i.storage_bucket='evo-store-products'
  JOIN storage.objects o
    ON o.bucket_id='evo-store-products' AND o.name=l.storage_path
  WHERE l.product_id=target_product
    AND l.status='verified'
    AND i.is_active=true
    AND (
      (l.printful_file_id=1082848720 AND l.color_code='BLACK' AND i.sort_order=0)
      OR (l.printful_file_id=1082848721 AND l.color_code='MIDNIGHT-NAVY' AND i.sort_order=1)
      OR (l.printful_file_id=1082848722 AND l.color_code='COOL-BLUE' AND i.sort_order=2)
    );
  IF ready_images <> 3 OR (
    SELECT count(*) FROM private.evo_store_printful_mockup_ingestions l
    WHERE l.product_id=target_product
  ) <> 3 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRINTFUL_GALLERY_NOT_VERIFIED';
  END IF;

  -- Only mark the Black image as primary. Ordering remains 0,1,2.
  UPDATE public.evo_store_product_images i
  SET is_primary=(i.storage_path = (
    SELECT l.storage_path FROM private.evo_store_printful_mockup_ingestions l
    WHERE l.product_id=target_product AND l.printful_file_id=1082848720
      AND l.status='verified'
  ))
  WHERE i.product_id=target_product;

  IF (SELECT count(*) FROM public.evo_store_product_images
      WHERE product_id=target_product AND is_primary) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRINTFUL_GALLERY_PRIMARY_INVALID';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_evo_store_printful_gallery()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.finalize_evo_store_printful_gallery()
  TO authenticated;
COMMIT;
