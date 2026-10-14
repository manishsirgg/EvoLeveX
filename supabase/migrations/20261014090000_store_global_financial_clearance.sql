-- PR #227: explicit financial-policy attestations for global merchant checkout.
-- This is an eligibility gate, NOT payable order finalization or payment authorization.
BEGIN;
CREATE TABLE IF NOT EXISTS private.evo_store_global_financial_clearances (
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency IN ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')),
  shipping_tax_reviewed boolean NOT NULL DEFAULT false,
  import_duties_reviewed boolean NOT NULL DEFAULT false,
  merchant_fulfillment_reviewed boolean NOT NULL DEFAULT false,
  payment_currency_reviewed boolean NOT NULL DEFAULT false,
  review_reference text NOT NULL CHECK (length(btrim(review_reference)) BETWEEN 12 AND 500),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(country_code,currency)
);
REVOKE ALL ON private.evo_store_global_financial_clearances FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.evo_store_global_financial_clearances ENABLE ROW LEVEL SECURITY;

-- Do not unlock payable conversion with attestations alone: this is an audit gate
-- for the next transactional finalization function and carrier/tax integrations.
CREATE OR REPLACE FUNCTION public.check_evo_store_global_financial_readiness(p_checkout_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
  buyer uuid := auth.uid();
  hold public.evo_store_checkouts%rowtype;
  saved private.evo_store_global_quote_snapshots%rowtype;
  fresh jsonb;
  clearance private.evo_store_global_financial_clearances%rowtype;
BEGIN
  IF buyer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='STORE_FINANCIAL_AUTH_REQUIRED';
  END IF;
  SELECT * INTO hold FROM public.evo_store_checkouts
    WHERE id=p_checkout_id AND user_id=buyer FOR UPDATE;
  IF NOT FOUND OR hold.status <> 'active' OR hold.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINANCIAL_CHECKOUT_UNAVAILABLE';
  END IF;
  SELECT * INTO saved FROM private.evo_store_global_quote_snapshots
    WHERE checkout_id=hold.id;
  IF NOT FOUND OR hold.shipping_total IS NOT NULL OR hold.tax_total IS NOT NULL
    OR hold.grand_total IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINANCIAL_SNAPSHOT_REQUIRED';
  END IF;
  -- Fresh preview rechecks variant/country delivery, rate, tax rules and order lines.
  fresh := public.preview_evo_store_global_checkout(hold.id);
  IF fresh IS DISTINCT FROM saved.breakdown THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINANCIAL_STALE_QUOTE';
  END IF;
  SELECT * INTO clearance FROM private.evo_store_global_financial_clearances c
    WHERE c.country_code=saved.country_code AND c.currency=saved.currency
      AND c.enabled=true AND c.shipping_tax_reviewed=true
      AND c.import_duties_reviewed=true AND c.merchant_fulfillment_reviewed=true
      AND c.payment_currency_reviewed=true;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINANCIAL_CLEARANCE_REQUIRED';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'checkout_id',hold.id,'country',saved.country_code,'currency',saved.currency,
    'review_reference',clearance.review_reference,
    'shipping_tax_status','requires_verified_financial_calculation',
    'duties_status','requires_verified_financial_calculation',
    'quote_payable',false);
END;
$body$;
REVOKE ALL ON FUNCTION public.check_evo_store_global_financial_readiness(uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.check_evo_store_global_financial_readiness(uuid) TO authenticated;
COMMIT;
