-- PR #230: authenticated, read-only Razorpay Store payment preflight.
-- Does not create a provider order, payment record, webhook receipt or inventory movement.
BEGIN;
CREATE OR REPLACE FUNCTION public.preflight_evo_store_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
  buyer uuid := auth.uid();
  pending_order public.orders%rowtype;
  hold public.evo_store_checkouts%rowtype;
  snapshot private.evo_store_merchant_order_financial_snapshots%rowtype;
  clearance private.evo_store_global_financial_clearances%rowtype;
  linked_checkout uuid;
  line_total numeric(14,2);
  item_count integer;
BEGIN
  IF buyer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='STORE_PAYMENT_AUTH_REQUIRED';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_PAYMENT_ORDER_REQUIRED';
  END IF;
  -- Hold-first lock ordering matches Store expiry/release; avoid order/hold inversion.
  SELECT link.checkout_id INTO linked_checkout
  FROM private.evo_store_checkout_order_links link
  JOIN public.evo_store_checkouts h ON h.id=link.checkout_id
  WHERE link.order_id=p_order_id AND h.user_id=buyer;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_HOLD_NOT_FOUND';
  END IF;
  SELECT * INTO hold FROM public.evo_store_checkouts h
  WHERE h.id=linked_checkout AND h.user_id=buyer FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_HOLD_NOT_FOUND';
  END IF;
  SELECT * INTO pending_order FROM public.orders o
  WHERE o.id=p_order_id AND o.user_id=buyer FOR UPDATE;
  IF NOT FOUND OR pending_order.status <> 'pending'
    OR pending_order.payment_status <> 'pending'
    OR pending_order.checkout_expired_at IS NOT NULL
    OR pending_order.checkout_expires_at IS NULL
    OR pending_order.checkout_expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_ORDER_UNAVAILABLE';
  END IF;
  IF hold.status <> 'active'
    OR hold.expires_at <= pg_catalog.now()
    OR hold.expires_at IS DISTINCT FROM pending_order.checkout_expires_at
    OR hold.grand_total IS DISTINCT FROM pending_order.total_amount
    OR hold.currency IS DISTINCT FROM pending_order.currency THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_HOLD_CONFLICT';
  END IF;
  SELECT * INTO snapshot FROM private.evo_store_merchant_order_financial_snapshots s
  WHERE s.order_id=p_order_id AND s.checkout_id=hold.id;
  IF NOT FOUND OR snapshot.payable_total IS DISTINCT FROM pending_order.total_amount
     OR snapshot.currency IS DISTINCT FROM pending_order.currency::text
     OR snapshot.import_duties <> 0 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_SNAPSHOT_CONFLICT';
  END IF;
  SELECT * INTO clearance FROM private.evo_store_global_financial_clearances c
  WHERE c.country_code=snapshot.country_code AND c.currency=snapshot.currency
    AND c.enabled AND c.shipping_tax_reviewed AND c.import_duties_reviewed
    AND c.merchant_fulfillment_reviewed AND c.payment_currency_reviewed;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_CLEARANCE_REVOKED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments payment WHERE payment.order_id=p_order_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_ALREADY_INITIATED';
  END IF;
  SELECT count(*),coalesce(sum(i.total_price),0) INTO item_count,line_total
  FROM public.order_items i WHERE i.order_id=p_order_id AND i.source='store';
  IF item_count < 1 OR line_total IS DISTINCT FROM pending_order.subtotal
    OR EXISTS(SELECT 1 FROM public.order_items i WHERE i.order_id=p_order_id
        AND i.source <> 'store') THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_ITEMS_CONFLICT';
  END IF;
  IF pending_order.total_amount IS NULL OR pending_order.total_amount <= 0
     OR pending_order.total_amount <>
       pending_order.subtotal - pending_order.discount_amount +
       pending_order.shipping_amount + pending_order.tax_amount
     OR snapshot.currency NOT IN ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')
     OR (snapshot.currency='JPY' AND pending_order.total_amount <> pg_catalog.trunc(pending_order.total_amount)) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PAYMENT_AMOUNT_INVALID';
  END IF;
  -- Advisory preflight only: caller must still create a payment intent atomically,
  -- generate a Razorpay order, and verify provider capabilities and captures.
  RETURN pg_catalog.jsonb_build_object(
    'order_id',pending_order.id,
    'amount',pending_order.total_amount,
    'currency',snapshot.currency,
    'expires_at',pending_order.checkout_expires_at,
    'payment_ready',false,
    'requires_provider_capability_check',true);
END;
$body$;
REVOKE ALL ON FUNCTION public.preflight_evo_store_payment(uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.preflight_evo_store_payment(uuid) TO authenticated;
COMMIT;
