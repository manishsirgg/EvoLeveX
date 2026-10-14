-- PR #220: an owner-bound, idempotent Store hold -> pending order transition.
-- Deliberately NOT a payment integration. Unknown shipping/tax are forbidden.
BEGIN;

CREATE TABLE IF NOT EXISTS private.evo_store_checkout_order_links (
  checkout_id uuid PRIMARY KEY REFERENCES public.evo_store_checkouts(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.evo_store_checkout_order_links FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.evo_store_checkout_order_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_pending_evo_store_order(p_checkout_id uuid)
RETURNS TABLE(order_id uuid, checkout_id uuid, amount numeric, currency text, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  buyer uuid := auth.uid();
  hold public.evo_store_checkouts%rowtype;
  linked_id uuid;
  new_order uuid;
  item_count integer;
  computed_subtotal numeric;
BEGIN
  IF buyer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='STORE_ORDER_AUTH_REQUIRED';
  END IF;
  IF p_checkout_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='STORE_ORDER_CHECKOUT_REQUIRED';
  END IF;
  -- Same hold row serializes duplicate requests and the expiry/release lifecycle.
  SELECT * INTO hold FROM public.evo_store_checkouts
    WHERE id=p_checkout_id AND user_id=buyer FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='STORE_ORDER_CHECKOUT_UNAVAILABLE';
  END IF;
  SELECT l.order_id INTO linked_id
    FROM private.evo_store_checkout_order_links l WHERE l.checkout_id=hold.id;
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id=linked_id AND o.user_id=buyer
        AND o.status='pending' AND o.payment_status='pending'
        AND o.checkout_expires_at > pg_catalog.now()
    ) THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STORE_ORDER_RECONCILIATION_REQUIRED';
    END IF;
    RETURN QUERY SELECT linked_id, hold.id, hold.grand_total, hold.currency::text, false;
    RETURN;
  END IF;
  IF hold.status <> 'active' OR hold.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STORE_ORDER_CHECKOUT_EXPIRED';
  END IF;
  IF hold.subtotal <= 0 OR hold.discount_total <> 0
     OR hold.shipping_total IS NULL OR hold.tax_total IS NULL
     OR hold.grand_total IS NULL OR hold.shipping_total < 0 OR hold.tax_total < 0
     OR hold.grand_total <> hold.subtotal - hold.discount_total + hold.shipping_total + hold.tax_total
     OR hold.grand_total <= 0 THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STORE_ORDER_TOTALS_NOT_FINAL';
  END IF;
  IF hold.shipping_full_name IS NULL OR hold.shipping_phone IS NULL
     OR hold.shipping_address_line1 IS NULL OR hold.shipping_city IS NULL
     OR hold.shipping_state IS NULL OR hold.shipping_postal_code IS NULL
     OR hold.shipping_country IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STORE_ORDER_ADDRESS_INVALID';
  END IF;

  SELECT count(*), coalesce(sum(i.line_subtotal),0)
    INTO item_count, computed_subtotal
    FROM public.evo_store_checkout_items i WHERE i.checkout_id=hold.id;
  IF item_count < 1 OR item_count > 50 OR computed_subtotal <> hold.subtotal
     OR EXISTS (
       SELECT 1 FROM public.evo_store_checkout_items i
       WHERE i.checkout_id=hold.id AND (
         i.quantity < 1 OR i.quantity > 10 OR i.unit_price <= 0
         OR i.line_subtotal <> i.quantity*i.unit_price
         OR i.product_name IS NULL OR i.sku IS NULL
       )
     ) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STORE_ORDER_ITEMS_INVALID';
  END IF;

  INSERT INTO public.orders (
    user_id,status,payment_status,subtotal,discount_amount,shipping_amount,tax_amount,
    total_amount,currency,address_id,shipping_name,shipping_phone,
    shipping_address_line1,shipping_address_line2,shipping_landmark,
    shipping_city,shipping_state,shipping_postal_code,shipping_country,checkout_expires_at
  ) VALUES (
    buyer,'pending','pending',hold.subtotal,hold.discount_total,hold.shipping_total,hold.tax_total,
    hold.grand_total,hold.currency,hold.address_id,hold.shipping_full_name,hold.shipping_phone,
    hold.shipping_address_line1,hold.shipping_address_line2,hold.shipping_landmark,
    hold.shipping_city,hold.shipping_state,hold.shipping_postal_code,hold.shipping_country,hold.expires_at
  ) RETURNING id INTO new_order;

  INSERT INTO public.order_items (
    order_id,source,store_variant_id,product_name_snapshot,sku_snapshot,
    quantity,unit_price,discount_amount,total_price,metadata
  )
  SELECT new_order,'store',i.variant_id,i.product_name,i.sku,
    i.quantity,i.unit_price,0,i.line_subtotal,
    pg_catalog.jsonb_build_object('checkout_id',hold.id)
  FROM public.evo_store_checkout_items i WHERE i.checkout_id=hold.id
  ORDER BY i.variant_id;

  INSERT INTO private.evo_store_checkout_order_links(checkout_id,order_id)
    VALUES (hold.id,new_order);
  RETURN QUERY SELECT new_order, hold.id, hold.grand_total, hold.currency::text, true;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_pending_evo_store_order(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_pending_evo_store_order(uuid) TO authenticated;
COMMIT;
