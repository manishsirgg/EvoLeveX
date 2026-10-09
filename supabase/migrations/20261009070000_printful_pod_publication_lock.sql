-- Keep Printful mapped products non-purchasable until POD checkout and fulfillment are implemented.
-- This migration does not alter existing products or import settings.
BEGIN;

CREATE FUNCTION private.block_unready_printful_publication()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.publication_status = 'published'::public.evo_store_publication_status
     AND EXISTS (
       SELECT 1 FROM private.evo_store_printful_product_maps m
       WHERE m.product_id = NEW.id
     )
  THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PRINTFUL_FULFILLMENT_NOT_READY';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.block_unready_printful_publication()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER evo_store_printful_publication_block
BEFORE UPDATE OF publication_status ON public.evo_store_products
FOR EACH ROW EXECUTE FUNCTION private.block_unready_printful_publication();

CREATE FUNCTION private.block_unready_printful_variant_activation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.is_active AND EXISTS (
    SELECT 1 FROM private.evo_store_printful_variant_maps vm
    WHERE vm.variant_id = NEW.id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PRINTFUL_FULFILLMENT_NOT_READY';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.block_unready_printful_variant_activation()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER evo_store_printful_variant_activation_block
BEFORE UPDATE OF is_active ON public.evo_store_variants
FOR EACH ROW EXECUTE FUNCTION private.block_unready_printful_variant_activation();

COMMIT;
