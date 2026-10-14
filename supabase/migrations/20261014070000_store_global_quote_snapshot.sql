-- PR #224: persistent, nonpayable global shipping/tax quote evidence.
-- Does not finalize an order or authorize payment. Policy changes require re-quotation.
BEGIN;
CREATE OR REPLACE FUNCTION public.snapshot_evo_store_global_quote(p_checkout_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
  buyer uuid := auth.uid();
  hold public.evo_store_checkouts%rowtype;
  quote jsonb;
  prior private.evo_store_global_quote_snapshots%rowtype;
  destination text;
  currency_code text;
  included_tax numeric;
  shipping numeric;
BEGIN
  IF buyer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='STORE_GLOBAL_AUTH_REQUIRED';
  END IF;
  IF p_checkout_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_GLOBAL_CHECKOUT_REQUIRED';
  END IF;
  SELECT * INTO hold FROM public.evo_store_checkouts
    WHERE id=p_checkout_id AND user_id=buyer FOR UPDATE;
  IF NOT FOUND OR hold.status <> 'active' OR hold.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_CHECKOUT_UNAVAILABLE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.evo_store_checkout_order_links l WHERE l.checkout_id=p_checkout_id
  ) OR hold.grand_total IS NOT NULL OR hold.shipping_total IS NOT NULL OR hold.tax_total IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_ALREADY_FINALIZED';
  END IF;
  -- The existing owner-bound preview validates country, currency, active merchant rate
  -- and per-variant inclusive tax rules. The same checkout lock spans the snapshot.
  quote := public.preview_evo_store_global_checkout(p_checkout_id);
  IF quote IS NULL OR quote->>'quote_payable' IS DISTINCT FROM 'false'
     OR quote->>'shipping_tax_status' IS DISTINCT FROM 'requires_external_validation' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_QUOTE_INVALID';
  END IF;
  destination := quote->>'country';
  currency_code := quote->>'currency';
  included_tax := (quote->>'included_product_tax')::numeric;
  shipping := (quote->>'shipping_before_any_applicable_shipping_tax')::numeric;
  SELECT * INTO prior FROM private.evo_store_global_quote_snapshots
    WHERE checkout_id=p_checkout_id FOR UPDATE;
  IF FOUND THEN
    IF prior.country_code IS DISTINCT FROM destination
       OR prior.currency IS DISTINCT FROM currency_code
       OR prior.product_included_tax IS DISTINCT FROM included_tax
       OR prior.shipping_amount IS DISTINCT FROM shipping
       OR prior.breakdown IS DISTINCT FROM quote THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_QUOTE_CHANGED';
    END IF;
  ELSE
    INSERT INTO private.evo_store_global_quote_snapshots
      (checkout_id,country_code,currency,product_included_tax,shipping_amount,
       shipping_tax_treatment,breakdown)
    VALUES(p_checkout_id,destination,currency_code,included_tax,shipping,
       'requires_external_validation',quote);
  END IF;
  RETURN quote;
END;
$body$;
REVOKE ALL ON FUNCTION public.snapshot_evo_store_global_quote(uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.snapshot_evo_store_global_quote(uuid) TO authenticated;
COMMIT;
