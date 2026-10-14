-- PR #223: Global merchant-shipping policy foundation; no payment activation.
-- Country + transaction currency are independent; no inferred FX or tax rates.
BEGIN;
CREATE TABLE IF NOT EXISTS private.evo_store_global_shipping_rates (
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency IN ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')),
  flat_shipping numeric(14,2) NOT NULL CHECK (flat_shipping >= 0),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_code,currency),
  CHECK (currency <> 'JPY' OR flat_shipping = trunc(flat_shipping))
);
CREATE TABLE IF NOT EXISTS private.evo_store_global_inclusive_tax_rules (
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  variant_id uuid NOT NULL REFERENCES public.evo_store_variants(id) ON DELETE RESTRICT,
  inclusive_rate_percent numeric(6,3) NOT NULL CHECK (inclusive_rate_percent BETWEEN 0 AND 100),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_code,variant_id)
);
CREATE TABLE IF NOT EXISTS private.evo_store_global_quote_snapshots (
  checkout_id uuid PRIMARY KEY REFERENCES public.evo_store_checkouts(id) ON DELETE RESTRICT,
  country_code text NOT NULL,
  currency text NOT NULL,
  product_included_tax numeric(14,2) NOT NULL CHECK (product_included_tax>=0),
  shipping_amount numeric(14,2) NOT NULL CHECK (shipping_amount>=0),
  shipping_tax_treatment text NOT NULL CHECK (shipping_tax_treatment='requires_external_validation'),
  breakdown jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.evo_store_global_shipping_rates,
 private.evo_store_global_inclusive_tax_rules,
 private.evo_store_global_quote_snapshots FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.evo_store_global_shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.evo_store_global_inclusive_tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.evo_store_global_quote_snapshots ENABLE ROW LEVEL SECURITY;

-- Read-only quote preview. No finalization until shipping taxes and tax jurisdictions verified.
-- Country ISO-2 address normalization stays explicit; unsupported address formats fail closed.
CREATE OR REPLACE FUNCTION public.preview_evo_store_global_checkout(p_checkout_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
  buyer uuid := auth.uid();
  hold public.evo_store_checkouts%rowtype;
  shipping private.evo_store_global_shipping_rates%rowtype;
  included_tax numeric := 0;
  lines jsonb := '[]'::jsonb;
  line record;
  line_tax numeric;
  expected_currency text;
  country text;
BEGIN
  IF buyer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='STORE_GLOBAL_AUTH_REQUIRED';
  END IF;
  SELECT * INTO hold FROM public.evo_store_checkouts
   WHERE id=p_checkout_id AND user_id=buyer FOR UPDATE;
  IF NOT FOUND OR hold.status <> 'active' OR hold.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_CHECKOUT_UNAVAILABLE';
  END IF;
  expected_currency := hold.currency::text;
  -- ISO-2 values required for new global checkouts. Legacy 'India' is read-only compatibility.
  country := CASE WHEN pg_catalog.upper(pg_catalog.btrim(hold.shipping_country))='INDIA' THEN 'IN'
      ELSE pg_catalog.upper(pg_catalog.btrim(hold.shipping_country)) END;
  IF country !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_COUNTRY_INVALID';
  END IF;
  SELECT * INTO shipping FROM private.evo_store_global_shipping_rates s
    WHERE s.country_code=country AND s.currency=expected_currency AND s.enabled=true;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_DESTINATION_UNCONFIGURED';
  END IF;
  FOR line IN
    SELECT i.variant_id,i.quantity,i.unit_price,i.line_subtotal,r.inclusive_rate_percent
    FROM public.evo_store_checkout_items i
    LEFT JOIN private.evo_store_global_inclusive_tax_rules r
      ON r.variant_id=i.variant_id AND r.country_code=country AND r.enabled=true
    WHERE i.checkout_id=hold.id
    ORDER BY i.variant_id
  LOOP
    IF line.inclusive_rate_percent IS NULL OR line.quantity <= 0
       OR line.unit_price <= 0 OR line.line_subtotal <> line.quantity*line.unit_price THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_TAX_RULE_MISSING';
    END IF;
    line_tax := CASE WHEN expected_currency='JPY'
      THEN pg_catalog.round(line.line_subtotal*line.inclusive_rate_percent/(100+line.inclusive_rate_percent),0)
      ELSE pg_catalog.round(line.line_subtotal*line.inclusive_rate_percent/(100+line.inclusive_rate_percent),2) END;
    included_tax := included_tax+line_tax;
    lines := lines || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'variant_id',line.variant_id,'quantity',line.quantity,
      'rate_percent',line.inclusive_rate_percent,
      'included_tax',line_tax,'gross_line_total',line.line_subtotal));
  END LOOP;
  IF pg_catalog.jsonb_array_length(lines)=0 OR hold.subtotal <= 0
     OR hold.discount_total <> 0 OR hold.subtotal IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_GLOBAL_SUBTOTAL_INVALID';
  END IF;
  -- Shipping-tax liability is NOT assumed zero; preview only.
  RETURN pg_catalog.jsonb_build_object(
    'checkout_id',hold.id,'country',country,'currency',expected_currency,
    'subtotal_tax_inclusive',hold.subtotal,
    'included_product_tax',included_tax,
    'shipping_before_any_applicable_shipping_tax',shipping.flat_shipping,
    'shipping_tax_status','requires_external_validation',
    'quote_payable',false,'items',lines);
END;
$body$;
REVOKE ALL ON FUNCTION public.preview_evo_store_global_checkout(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.preview_evo_store_global_checkout(uuid) TO authenticated;
COMMIT;
