-- PR #222: merchant-fulfilled INR domestic flat shipping and tax-inclusive prices.
-- Configuration has no defaults: checkout finalization fails until staff configures both values.
BEGIN;
CREATE TABLE IF NOT EXISTS private.evo_store_domestic_checkout_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  shipping_flat_inr numeric(14,2) NOT NULL CHECK (shipping_flat_inr >= 0),
  tax_rate_percent numeric(6,3) NOT NULL CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100),
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.evo_store_domestic_checkout_policy FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.evo_store_domestic_checkout_policy ENABLE ROW LEVEL SECURITY;

-- Policy is deliberately configured by a controlled SQL migration/operator, not client input.
CREATE OR REPLACE FUNCTION public.finalize_evo_store_domestic_checkout(p_checkout_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
DECLARE
  buyer uuid := auth.uid();
  hold public.evo_store_checkouts%rowtype;
  policy private.evo_store_domestic_checkout_policy%rowtype;
  inclusive_tax numeric(14,2);
  computed_total numeric(14,2);
BEGIN
  IF buyer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='STORE_SHIPPING_AUTH_REQUIRED';
  END IF;
  IF p_checkout_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_SHIPPING_CHECKOUT_REQUIRED';
  END IF;
  SELECT * INTO hold FROM public.evo_store_checkouts
    WHERE id=p_checkout_id AND user_id=buyer FOR UPDATE;
  IF NOT FOUND OR hold.status <> 'active' OR hold.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_SHIPPING_CHECKOUT_UNAVAILABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM private.evo_store_checkout_order_links l WHERE l.checkout_id=hold.id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_SHIPPING_ORDER_ALREADY_CREATED';
  END IF;
  IF hold.currency::text <> 'INR' OR pg_catalog.lower(pg_catalog.btrim(hold.shipping_country)) NOT IN ('india','in') THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_SHIPPING_DESTINATION_UNSUPPORTED';
  END IF;
  SELECT * INTO policy FROM private.evo_store_domestic_checkout_policy
    WHERE id=true FOR SHARE;
  IF NOT FOUND OR policy.is_enabled IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_SHIPPING_POLICY_UNCONFIGURED';
  END IF;
  IF hold.subtotal IS NULL OR hold.subtotal <= 0 OR hold.discount_total <> 0 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_SHIPPING_SUBTOTAL_INVALID';
  END IF;
  -- The listed subtotal already includes tax. Tax is informational, not added again.
  inclusive_tax := pg_catalog.round(hold.subtotal * policy.tax_rate_percent
    / (100 + policy.tax_rate_percent),2);
  computed_total := hold.subtotal + policy.shipping_flat_inr;
  IF computed_total > 999999999999.99 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_SHIPPING_TOTAL_INVALID';
  END IF;
  IF hold.shipping_total IS NOT NULL OR hold.tax_total IS NOT NULL
      OR hold.grand_total IS NOT NULL THEN
    IF hold.shipping_total IS DISTINCT FROM policy.shipping_flat_inr
       OR hold.tax_total IS DISTINCT FROM 0::numeric
       OR hold.grand_total IS DISTINCT FROM computed_total THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_SHIPPING_QUOTE_CHANGED';
    END IF;
  ELSE
    UPDATE public.evo_store_checkouts
    SET shipping_total=policy.shipping_flat_inr, tax_total=0,
        grand_total=computed_total, updated_at=pg_catalog.now()
    WHERE id=hold.id;
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'checkout_id',hold.id,'currency','INR',
    'subtotal_including_tax',hold.subtotal,
    'included_product_tax',inclusive_tax,
    'shipping',policy.shipping_flat_inr,
    'tax_added_at_checkout',0,
    'grand_total',computed_total,'tax_rate_percent',policy.tax_rate_percent);
END;
$body$;
REVOKE ALL ON FUNCTION public.finalize_evo_store_domestic_checkout(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.finalize_evo_store_domestic_checkout(uuid) TO authenticated;
COMMIT;
