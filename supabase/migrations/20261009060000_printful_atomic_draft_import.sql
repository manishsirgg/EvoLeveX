-- Phase B4: atomic Printful draft import. Forward-only, review before production.
-- No shipping, inventory, prices, images, orders, or publication side effects.
BEGIN;
CREATE FUNCTION public.import_evo_store_printful_draft(
  p_store_external_id text,
  p_category_id uuid,
  p_product jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  local_store uuid;
  local_product uuid;
  local_map uuid;
  product_external text;
  title text;
  slug_value text;
  entry jsonb;
  count_variants integer;
  variant_uuid uuid;
  sku_value text;
  size_value text;
  color_value text;
  sync_id text;
  catalog_id text;
  checked_count integer := 0;
BEGIN
  -- Explicit admin-role authorization; never trust client-side buttons alone.
  IF caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=caller AND r.code IN ('super_admin','admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='PRINTFUL_IMPORT_FORBIDDEN';
  END IF;
  IF p_store_external_id IS NULL OR p_store_external_id !~ '^[0-9]{1,30}$'
     OR p_product IS NULL OR pg_catalog.jsonb_typeof(p_product)<>'object'
     OR pg_catalog.jsonb_typeof(p_product->'variants') <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_IMPORT_INVALID';
  END IF;
  count_variants := pg_catalog.jsonb_array_length(p_product->'variants');
  IF count_variants NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_IMPORT_VARIANTS_INVALID';
  END IF;
  product_external := p_product->>'syncProductId';
  title := pg_catalog.btrim(p_product->>'title');
  slug_value := p_product->>'slug';
  IF product_external IS NULL OR product_external !~ '^[0-9]{1,30}$'
     OR title IS NULL OR pg_catalog.length(title) NOT BETWEEN 1 AND 120
     OR slug_value IS NULL OR slug_value !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     OR pg_catalog.length(slug_value) > 120 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_IMPORT_PRODUCT_INVALID';
  END IF;
  SELECT s.id INTO local_store FROM private.evo_store_printful_stores s
    WHERE s.external_store_id=p_store_external_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_STORE_NOT_REGISTERED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.evo_store_categories cat
    WHERE cat.id=p_category_id AND cat.is_active
      AND NOT EXISTS (SELECT 1 FROM public.evo_store_categories child WHERE child.parent_id=cat.id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_IMPORT_CATEGORY_INVALID';
  END IF;
  SELECT pm.product_id INTO local_product
    FROM private.evo_store_printful_product_maps pm
    WHERE pm.store_id=local_store AND pm.sync_product_id=product_external;
  IF FOUND THEN
    -- Import is create-once; never silently overwrite merchant-edited drafts.
    RETURN local_product;
  END IF;
  -- A single transaction owns the product and every mapping. Any failure rolls it back.
  INSERT INTO public.evo_store_products(
    category_id,name,slug,product_mode,publication_status,base_price,currency,is_featured
  ) VALUES (
    p_category_id,title,slug_value,'physical','draft',0,'USD',false
  ) RETURNING id INTO local_product;
  INSERT INTO private.evo_store_printful_product_maps(
    store_id,product_id,sync_product_id,sync_state
  ) VALUES(local_store,local_product,product_external,'pending')
  RETURNING id INTO local_map;

  FOR entry IN SELECT value FROM pg_catalog.jsonb_array_elements(p_product->'variants') LOOP
    IF pg_catalog.jsonb_typeof(entry)<>'object' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_IMPORT_VARIANT_INVALID';
    END IF;
    sync_id := entry->>'syncId';
    catalog_id := entry->>'catalogId';
    sku_value := pg_catalog.upper(pg_catalog.btrim(entry->>'sku'));
    size_value := pg_catalog.upper(pg_catalog.btrim(entry->>'size'));
    color_value := pg_catalog.upper(pg_catalog.btrim(entry->>'color'));
    IF sync_id IS NULL OR sync_id !~ '^[0-9]{1,30}$'
      OR catalog_id IS NULL OR catalog_id !~ '^[0-9]{1,30}$'
      OR sku_value IS NULL OR sku_value !~ '^[A-Z0-9][A-Z0-9._/-]{0,63}$'
      OR size_value IS NULL OR size_value !~ '^[A-Z0-9][A-Z0-9._/-]{0,31}$'
      OR color_value IS NULL OR color_value !~ '^[A-Z0-9][A-Z0-9._/-]{0,31}$' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_IMPORT_VARIANT_INVALID';
    END IF;
    INSERT INTO public.evo_store_variants(
      product_id,sku,name,price,currency,size_code,color_code,is_active,sort_order
    ) VALUES (
      local_product,sku_value,pg_catalog.left(sku_value,160),0,'USD',size_value,color_value,false,checked_count
    ) RETURNING id INTO variant_uuid;
    INSERT INTO private.evo_store_printful_variant_maps(
      product_map_id,product_id,variant_id,sync_variant_id,catalog_variant_id,sync_state
    ) VALUES(local_map,local_product,variant_uuid,sync_id,catalog_id,'pending');
    checked_count := checked_count + 1;
  END LOOP;
  IF checked_count<>count_variants THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_IMPORT_VARIANT_COUNT_MISMATCH';
  END IF;
  RETURN local_product;
END;
$$;
REVOKE ALL ON FUNCTION public.import_evo_store_printful_draft(text,uuid,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_evo_store_printful_draft(text,uuid,jsonb)
  TO authenticated;
COMMIT;
