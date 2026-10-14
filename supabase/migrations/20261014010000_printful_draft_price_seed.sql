-- Atomic, non-overwriting price seed for a verified Printful draft product.
-- No prices are activated and no product/variant publication states are modified.
BEGIN;
CREATE OR REPLACE FUNCTION public.seed_evo_store_printful_draft_prices(
  p_product_id uuid, p_expected_slug text, p_prices jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_expected integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid() AND r.code IN ('admin','super_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='PRINTFUL_PRICE_FORBIDDEN';
  END IF;
  IF p_product_id IS NULL OR p_expected_slug IS NULL
     OR p_expected_slug !~ '^printful-[0-9]+$'
     OR jsonb_typeof(p_prices) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_prices) <> 10 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_PRICE_INVALID_INPUT';
  END IF;
  PERFORM 1 FROM public.evo_store_products p
    WHERE p.id=p_product_id AND p.slug=p_expected_slug
      AND p.publication_status='draft'::public.evo_store_publication_status
      AND p.is_active=false FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='PRINTFUL_PRICE_PRODUCT_NOT_DRAFT';
  END IF;
  -- Lock the variant rows so an administrative variant mutation cannot race.
  PERFORM 1 FROM public.evo_store_variants v
    WHERE v.product_id=p_product_id ORDER BY v.id FOR UPDATE;
  SELECT count(*) INTO v_expected FROM public.evo_store_variants v
    WHERE v.product_id=p_product_id AND v.is_active=false;
  IF v_expected<>10 OR EXISTS (
    SELECT 1 FROM public.evo_store_variants v
    WHERE v.product_id=p_product_id AND v.is_active=true
  ) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_PRICE_VARIANTS_CHANGED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.evo_store_variant_prices pr
    JOIN public.evo_store_variants v ON v.id=pr.variant_id
    WHERE v.product_id=p_product_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='PRINTFUL_PRICE_ALREADY_CONFIGURED';
  END IF;
  -- Reject any duplicate, foreign, missing, non-USD or malformed input row.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_prices) AS e(item)
    WHERE jsonb_typeof(item) <> 'object'
       OR item->>'currency' <> 'USD'
       OR (item->>'amount') !~ '^[0-9]{1,6}[.][0-9]{2}$'
       OR (item->>'amount')::numeric <= 0
       OR (item->>'amount')::numeric > 999999
       OR (item->>'variant_id') !~ '^[0-9a-f]{8}-[0-9a-f-]{27,}$'
  ) OR (
    SELECT count(DISTINCT item->>'variant_id')
    FROM jsonb_array_elements(p_prices) AS e(item)
  )<>10 OR (
    SELECT count(*) FROM jsonb_array_elements(p_prices) AS e(item)
    JOIN public.evo_store_variants v ON v.id=(item->>'variant_id')::uuid
    WHERE v.product_id=p_product_id AND v.is_active=false
  )<>10 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_PRICE_MAPPING_INVALID';
  END IF;
  INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount,is_active)
    SELECT (item->>'variant_id')::uuid, 'USD', (item->>'amount')::numeric, false
    FROM jsonb_array_elements(p_prices) AS e(item);
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>10 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_PRICE_PARTIAL_INSERT';
  END IF;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.seed_evo_store_printful_draft_prices(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.seed_evo_store_printful_draft_prices(uuid,text,jsonb)
  TO authenticated;
COMMIT;
