-- PR #179: authenticated admin reservation for metadata-first Printful mockup uploads.
-- No image transfer is enabled by this migration.
BEGIN;
CREATE FUNCTION public.reserve_evo_store_printful_mockup(
  p_product_id uuid, p_printful_file_id bigint, p_color_code text,
  p_storage_path text, p_sort_order integer, p_alt_text text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  local_image uuid;
  existing record;
BEGIN
  IF caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = caller AND r.code IN ('admin','super_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PRINTFUL_MEDIA_FORBIDDEN';
  END IF;
  IF p_product_id IS NULL
     OR (p_printful_file_id, p_color_code, p_sort_order) NOT IN (
       (1082848720::bigint, 'BLACK'::text, 0),
       (1082848721::bigint, 'MIDNIGHT-NAVY'::text, 1),
       (1082848722::bigint, 'COOL-BLUE'::text, 2)
     )
     OR p_printful_file_id IS NULL OR p_color_code IS NULL OR p_sort_order IS NULL
     OR p_alt_text IS NULL OR length(p_alt_text) NOT BETWEEN 12 AND 160
     OR p_storage_path IS NULL
     OR p_storage_path !~ ('^' || p_product_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}[.]png$')
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PRINTFUL_MEDIA_INVALID';
  END IF;
  -- Acquire the parent product lock before checking status or ledger identity.
  PERFORM 1 FROM public.evo_store_products
  WHERE id = p_product_id AND slug = 'printful-479728769'
    AND publication_status = 'draft'::public.evo_store_publication_status
  FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM private.evo_store_printful_product_maps m
    WHERE m.product_id = p_product_id AND m.sync_product_id = '479728769'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PRINTFUL_MEDIA_PRODUCT_UNVERIFIED';
  END IF;
  SELECT * INTO existing FROM private.evo_store_printful_mockup_ingestions
  WHERE product_id = p_product_id AND printful_file_id = p_printful_file_id;
  IF FOUND THEN
    IF existing.storage_path <> p_storage_path OR existing.color_code <> p_color_code
    THEN RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PRINTFUL_MEDIA_IDENTITY_CONFLICT';
    END IF;
    IF existing.status <> 'pending' THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'PRINTFUL_MEDIA_ALREADY_PROCESSED';
    END IF;
    SELECT i.id INTO local_image FROM public.evo_store_product_images i
    WHERE i.product_id = p_product_id AND i.storage_path = p_storage_path;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRINTFUL_MEDIA_NEEDS_RECONCILIATION';
    END IF;
    RETURN local_image;
  END IF;
  -- The metadata record is created first to satisfy existing Storage RLS.
  INSERT INTO public.evo_store_product_images
    (product_id,storage_bucket,storage_path,alt_text,sort_order,is_primary,is_active)
  VALUES (p_product_id,'evo-store-products',p_storage_path,p_alt_text,p_sort_order,false,false)
  RETURNING id INTO local_image;
  INSERT INTO private.evo_store_printful_mockup_ingestions
    (product_id,printful_file_id,color_code,storage_path,status)
  VALUES (p_product_id,p_printful_file_id,p_color_code,p_storage_path,'pending');
  RETURN local_image;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_evo_store_printful_mockup(uuid,bigint,text,text,integer,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reserve_evo_store_printful_mockup(uuid,bigint,text,text,integer,text)
  TO authenticated;
COMMIT;
