-- Store Razorpay intent reservation; NO provider requests or payment creation.
-- Client payment remains blocked pending verified provider reconciliation.
BEGIN;
CREATE TABLE IF NOT EXISTS private.evo_store_razorpay_intent_claims (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  intent_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK(amount > 0),
  currency text NOT NULL CHECK(currency IN ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')),
  state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','reconciliation_required','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key)
);
REVOKE ALL ON private.evo_store_razorpay_intent_claims FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE private.evo_store_razorpay_intent_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_evo_store_razorpay_intent(p_order_id uuid,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
  buyer uuid := auth.uid();
  preflight jsonb;
  existing private.evo_store_razorpay_intent_claims%rowtype;
  claimed private.evo_store_razorpay_intent_claims%rowtype;
BEGIN
  IF buyer IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='STORE_INTENT_AUTH_REQUIRED';
  END IF;
  IF p_order_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_INTENT_ARGUMENT_INVALID';
  END IF;
  -- Preflight obtains hold-before-order locks, preserving existing expiry ordering.
  -- A claim is not proof of provider payment capability or captured payment.
  preflight := public.preflight_evo_store_payment(p_order_id);
  IF preflight->>'payment_ready' IS DISTINCT FROM 'false'
    OR preflight->>'requires_provider_capability_check' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_INTENT_PREFLIGHT_INVALID';
  END IF;
  SELECT * INTO existing
    FROM private.evo_store_razorpay_intent_claims c
    WHERE c.order_id=p_order_id FOR UPDATE;
  IF FOUND THEN
    IF existing.user_id IS DISTINCT FROM buyer
      OR existing.idempotency_key IS DISTINCT FROM p_idempotency_key
      OR existing.amount IS DISTINCT FROM (preflight->>'amount')::numeric
      OR existing.currency IS DISTINCT FROM preflight->>'currency'
      OR existing.state <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_INTENT_CONFLICT';
    END IF;
    RETURN pg_catalog.jsonb_build_object('intent_id',existing.intent_id,
      'order_id',existing.order_id,'amount',existing.amount,'currency',existing.currency,
      'created',false,'provider_order_created',false,'payment_ready',false);
  END IF;
  INSERT INTO private.evo_store_razorpay_intent_claims(
    order_id,user_id,idempotency_key,amount,currency)
    VALUES(p_order_id,buyer,p_idempotency_key,
      (preflight->>'amount')::numeric,preflight->>'currency')
    RETURNING * INTO claimed;
  RETURN pg_catalog.jsonb_build_object('intent_id',claimed.intent_id,
    'order_id',claimed.order_id,'amount',claimed.amount,'currency',claimed.currency,
    'created',true,'provider_order_created',false,'payment_ready',false);
END;
$body$;
REVOKE ALL ON FUNCTION public.claim_evo_store_razorpay_intent(uuid,uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.claim_evo_store_razorpay_intent(uuid,uuid) TO authenticated;
COMMIT;
