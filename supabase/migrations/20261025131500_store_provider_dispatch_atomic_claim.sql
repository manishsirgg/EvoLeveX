-- Evo Store V1: atomic dispatch claim for provider-order attempts.
-- Database capability only. No caller grants, HTTP dispatch or payment activation.
BEGIN;
CREATE OR REPLACE FUNCTION private.claim_evo_store_provider_dispatch(p_attempt_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
DECLARE
  attempt_row private.evo_store_provider_order_attempts%rowtype;
  intent_row private.evo_store_razorpay_intent_claims%rowtype;
  order_row public.orders%rowtype;
BEGIN
  IF p_attempt_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO attempt_row
    FROM private.evo_store_provider_order_attempts
    WHERE attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR attempt_row.state <> 'prepared'
    OR attempt_row.provider_order_id IS NOT NULL THEN RETURN false; END IF;
  SELECT * INTO intent_row
    FROM private.evo_store_razorpay_intent_claims
    WHERE intent_id = attempt_row.intent_id FOR UPDATE;
  IF NOT FOUND OR intent_row.state <> 'reserved'
    OR intent_row.order_id IS DISTINCT FROM attempt_row.order_id
    OR intent_row.amount IS DISTINCT FROM attempt_row.amount
    OR intent_row.currency IS DISTINCT FROM attempt_row.currency THEN
    RETURN false;
  END IF;
  -- Advisory freshness check; dispatch worker must revalidate immediately
  -- before POST and handle any concurrent expiry after this transaction.
  SELECT * INTO order_row FROM public.orders
    WHERE id = attempt_row.order_id;
  IF NOT FOUND OR order_row.status <> 'pending'
    OR order_row.payment_status <> 'pending'
    OR order_row.checkout_expires_at IS NULL
    OR order_row.checkout_expires_at <= pg_catalog.now()
    OR order_row.total_amount IS DISTINCT FROM attempt_row.amount
    OR order_row.currency::text IS DISTINCT FROM attempt_row.currency THEN
    RETURN false;
  END IF;
  UPDATE private.evo_store_provider_order_attempts
    SET state = 'dispatch_uncertain', updated_at = pg_catalog.now()
    WHERE attempt_id = p_attempt_id AND state = 'prepared';
  RETURN FOUND;
END;
$body$;
REVOKE ALL ON FUNCTION private.claim_evo_store_provider_dispatch(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION private.claim_evo_store_provider_dispatch(uuid) IS
  'Owner-only one-way dispatch claim. Never grants provider POST authority or payment approval; do not grant client EXECUTE.';
COMMIT;
