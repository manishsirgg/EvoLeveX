-- PR #228: tightly scoped merchant Store financial finalization with explicitly reviewed
-- ZERO import duties. Nonzero duties are rejected until orders have a dedicated duty component.
-- Existing merchant product subtotal is tax inclusive; tax_total represents shipping tax ONLY.
-- No Razorpay initiation, stock consumption, or Printful API calls.
BEGIN;
CREATE TABLE IF NOT EXISTS private.evo_store_merchant_final_charge_rules (
  country_code text NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK(currency IN ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')),
  shipping_tax_amount numeric(14,2) NOT NULL CHECK(shipping_tax_amount>=0),
  import_duties_amount numeric(14,2) NOT NULL CHECK(import_duties_amount>=0),
  legal_review_reference text NOT NULL CHECK(length(btrim(legal_review_reference)) BETWEEN 12 AND 500),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(country_code,currency),
  CHECK(currency <> 'JPY' OR (
    shipping_tax_amount=trunc(shipping_tax_amount)
    AND import_duties_amount=trunc(import_duties_amount)))
);
CREATE TABLE IF NOT EXISTS private.evo_store_merchant_order_financial_snapshots (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  checkout_id uuid NOT NULL UNIQUE REFERENCES public.evo_store_checkouts(id) ON DELETE RESTRICT,
  country_code text NOT NULL,
  currency text NOT NULL,
  product_tax_included numeric(14,2) NOT NULL,
  shipping_base numeric(14,2) NOT NULL,
  shipping_tax numeric(14,2) NOT NULL,
  import_duties numeric(14,2) NOT NULL CHECK(import_duties=0),
  payable_total numeric(14,2) NOT NULL,
  policy_reference text NOT NULL,
  breakdown jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.evo_store_merchant_final_charge_rules,
 private.evo_store_merchant_order_financial_snapshots FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.evo_store_merchant_final_charge_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.evo_store_merchant_order_financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.finalize_evo_store_merchant_order(p_checkout_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
  buyer uuid := auth.uid();
  hold public.evo_store_checkouts%rowtype;
  snapshot private.evo_store_global_quote_snapshots%rowtype;
  clearance private.evo_store_global_financial_clearances%rowtype;
  charges private.evo_store_merchant_final_charge_rules%rowtype;
  current_quote jsonb;
  result_row record;
  subtotal numeric;
  total numeric;
  shipping numeric;
  included_tax numeric;
BEGIN
  IF buyer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='STORE_FINAL_AUTH_REQUIRED';
  END IF;
  IF p_checkout_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_FINAL_CHECKOUT_REQUIRED';
  END IF;
  SELECT * INTO hold FROM public.evo_store_checkouts
    WHERE id=p_checkout_id AND user_id=buyer FOR UPDATE;
  IF NOT FOUND OR hold.status <> 'active' OR hold.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_CHECKOUT_UNAVAILABLE';
  END IF;
  -- If already linked, only allow strictly consistent idempotent replay.
  IF EXISTS (SELECT 1 FROM private.evo_store_checkout_order_links WHERE checkout_id=hold.id) THEN
    SELECT * INTO result_row FROM public.create_pending_evo_store_order(hold.id);
    IF NOT EXISTS (
      SELECT 1 FROM private.evo_store_merchant_order_financial_snapshots s
      WHERE s.order_id=result_row.order_id AND s.checkout_id=hold.id
        AND s.payable_total=result_row.amount AND s.currency=result_row.currency
    ) THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_RECONCILIATION_REQUIRED';
    END IF;
    RETURN pg_catalog.jsonb_build_object('order_id',result_row.order_id,
      'currency',result_row.currency,'amount',result_row.amount,'created',false);
  END IF;
  IF hold.shipping_total IS NOT NULL OR hold.tax_total IS NOT NULL
     OR hold.grand_total IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_ALREADY_FINALIZED';
  END IF;
  SELECT * INTO snapshot FROM private.evo_store_global_quote_snapshots
    WHERE checkout_id=hold.id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_SNAPSHOT_REQUIRED';
  END IF;
  current_quote := public.preview_evo_store_global_checkout(hold.id);
  IF current_quote IS DISTINCT FROM snapshot.breakdown
     OR current_quote->>'quote_payable' IS DISTINCT FROM 'false'
     OR snapshot.shipping_tax_treatment <> 'requires_external_validation'
     OR snapshot.currency IS DISTINCT FROM hold.currency::text THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_STALE_QUOTE';
  END IF;
  SELECT * INTO clearance FROM private.evo_store_global_financial_clearances c
    WHERE c.country_code=snapshot.country_code AND c.currency=snapshot.currency
      AND c.enabled AND c.shipping_tax_reviewed AND c.import_duties_reviewed
      AND c.merchant_fulfillment_reviewed AND c.payment_currency_reviewed
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_CLEARANCE_REQUIRED';
  END IF;
  SELECT * INTO charges FROM private.evo_store_merchant_final_charge_rules c
    WHERE c.country_code=snapshot.country_code AND c.currency=snapshot.currency
      AND c.enabled FOR SHARE;
  IF NOT FOUND OR charges.import_duties_amount <> 0 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_CHARGES_UNSUPPORTED';
  END IF;
  -- Subtotal is already inclusive of product tax. Shipping tax is extra.
  subtotal := (current_quote->>'subtotal_tax_inclusive')::numeric;
  included_tax := (current_quote->>'included_product_tax')::numeric;
  shipping := snapshot.shipping_amount;
  total := subtotal + shipping + charges.shipping_tax_amount;
  IF subtotal IS NULL OR subtotal <= 0 OR included_tax IS NULL
    OR total IS NULL OR total <= 0 OR total > 999999999999.99
    OR (snapshot.currency='JPY' AND total <> trunc(total)) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_TOTAL_INVALID';
  END IF;
  UPDATE public.evo_store_checkouts
    SET shipping_total=shipping, tax_total=charges.shipping_tax_amount,
      grand_total=total, updated_at=pg_catalog.now()
    WHERE id=hold.id AND status='active';
  SELECT * INTO result_row FROM public.create_pending_evo_store_order(hold.id);
  IF result_row.order_id IS NULL OR result_row.created IS DISTINCT FROM true
    OR result_row.amount IS DISTINCT FROM total THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_FINAL_ORDER_FAILED';
  END IF;
  INSERT INTO private.evo_store_merchant_order_financial_snapshots(
    order_id,checkout_id,country_code,currency,product_tax_included,
    shipping_base,shipping_tax,import_duties,payable_total,policy_reference,breakdown
  ) VALUES (
    result_row.order_id,hold.id,snapshot.country_code,snapshot.currency,
    included_tax,shipping,charges.shipping_tax_amount,0,total,
    charges.legal_review_reference,pg_catalog.jsonb_build_object(
      'quote',current_quote,'clearance_reference',clearance.review_reference,
      'shipping_tax',charges.shipping_tax_amount,'import_duties',0));
  RETURN pg_catalog.jsonb_build_object('order_id',result_row.order_id,
    'currency',result_row.currency,'amount',result_row.amount,'created',true);
END;
$body$;
REVOKE ALL ON FUNCTION public.finalize_evo_store_merchant_order(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.finalize_evo_store_merchant_order(uuid) TO authenticated;
COMMIT;
