-- PR #221: releasing/expiring a checkout cannot leave a payable linked Store order.
-- Preserve the Vault-only payment path. Fail closed for in-flight provider orders.
BEGIN;
CREATE OR REPLACE FUNCTION private.cancel_evo_store_order_on_hold_end()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
DECLARE
  linked_order uuid;
  current_order public.orders%rowtype;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.status NOT IN ('released', 'expired') THEN
    RETURN NEW;
  END IF;

  SELECT relation.order_id INTO linked_order
  FROM private.evo_store_checkout_order_links relation
  WHERE relation.checkout_id = NEW.id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO current_order
  FROM public.orders o
  WHERE o.id = linked_order AND o.user_id = NEW.user_id
  FOR UPDATE;
  IF NOT FOUND
     OR current_order.status IS DISTINCT FROM 'pending'
     OR current_order.payment_status IS DISTINCT FROM 'pending'
     OR current_order.checkout_expires_at IS DISTINCT FROM NEW.expires_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'STORE_ORDER_RECONCILIATION_REQUIRED';
  END IF;

  -- A provider order may already have captured payment outside our visibility.
  -- Do not expire it or release stock without canonical provider reconciliation.
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.order_id = linked_order
      AND (p.status IS DISTINCT FROM 'pending'
           OR p.provider_order_id IS NOT NULL
           OR p.provider_payment_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'STORE_ORDER_PROVIDER_RECONCILIATION_REQUIRED';
  END IF;

  UPDATE public.payments p SET status = 'failed'
  WHERE p.order_id = linked_order AND p.status = 'pending'
    AND p.provider_order_id IS NULL AND p.provider_payment_id IS NULL;

  UPDATE public.orders o
  SET status = 'cancelled', payment_status = 'failed',
      cancelled_at = pg_catalog.now(),
      checkout_expired_at = CASE WHEN NEW.status = 'expired'
        THEN pg_catalog.now() ELSE o.checkout_expired_at END
  WHERE o.id = linked_order AND o.status = 'pending' AND o.payment_status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'STORE_ORDER_RECONCILIATION_REQUIRED';
  END IF;
  RETURN NEW;
END;
$body$;

REVOKE ALL ON FUNCTION private.cancel_evo_store_order_on_hold_end()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS evo_store_checkout_linked_order_terminal
  ON public.evo_store_checkouts;
CREATE TRIGGER evo_store_checkout_linked_order_terminal
  AFTER UPDATE OF status ON public.evo_store_checkouts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION private.cancel_evo_store_order_on_hold_end();
COMMIT;
