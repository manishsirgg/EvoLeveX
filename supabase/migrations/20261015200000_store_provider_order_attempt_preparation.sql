-- PR #239: Store provider-order correlation ledger. No provider calls or payments.
BEGIN;
CREATE TABLE private.evo_store_provider_order_attempts (
  intent_id uuid PRIMARY KEY REFERENCES private.evo_store_razorpay_intent_claims(intent_id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  receipt text NOT NULL UNIQUE CHECK (receipt ~ '^evs_[0-9a-f]{32}$'),
  state text NOT NULL DEFAULT 'prepared'
    CHECK (state IN ('prepared','dispatch_uncertain','correlated','reconciliation_required','closed')),
  provider_order_id text UNIQUE
    CHECK (provider_order_id IS NULL OR provider_order_id ~ '^order_[A-Za-z0-9]{8,64}$'),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency IN ('USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_attempt_state_consistency CHECK (
    (state='correlated' AND provider_order_id IS NOT NULL)
    OR (state<>'correlated' AND provider_order_id IS NULL)
  )
);
REVOKE ALL ON private.evo_store_provider_order_attempts FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.evo_store_provider_order_attempts ENABLE ROW LEVEL SECURITY;
-- Reserve the deterministic identity without authorizing HTTP dispatch.
-- Only the SQL owner can invoke this private function. No EXECUTE grants.
CREATE FUNCTION private.prepare_evo_store_provider_attempt(p_intent_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
  claim private.evo_store_razorpay_intent_claims%rowtype;
  current_attempt private.evo_store_provider_order_attempts%rowtype;
BEGIN
  IF p_intent_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='STORE_PROVIDER_INTENT_REQUIRED';
  END IF;
  SELECT * INTO claim FROM private.evo_store_razorpay_intent_claims
    WHERE intent_id=p_intent_id FOR UPDATE;
  IF NOT FOUND OR claim.state<>'reserved' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_INTENT_UNAVAILABLE';
  END IF;
  SELECT * INTO current_attempt FROM private.evo_store_provider_order_attempts
    WHERE intent_id=claim.intent_id FOR UPDATE;
  IF FOUND THEN
    IF current_attempt.order_id IS DISTINCT FROM claim.order_id
      OR current_attempt.amount IS DISTINCT FROM claim.amount
      OR current_attempt.currency IS DISTINCT FROM claim.currency
      OR current_attempt.state <> 'prepared' THEN
      RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STORE_PROVIDER_ATTEMPT_LOCKED';
    END IF;
    RETURN pg_catalog.jsonb_build_object('attempt_id',current_attempt.attempt_id,
      'receipt',current_attempt.receipt,'state',current_attempt.state,'created',false,
      'dispatch_allowed',false);
  END IF;
  INSERT INTO private.evo_store_provider_order_attempts(intent_id,order_id,receipt,amount,currency)
  VALUES (claim.intent_id,claim.order_id,'evs_'||replace(claim.intent_id::text,'-',''),claim.amount,claim.currency)
  RETURNING * INTO current_attempt;
  RETURN pg_catalog.jsonb_build_object('attempt_id',current_attempt.attempt_id,
    'receipt',current_attempt.receipt,'state',current_attempt.state,'created',true,
    'dispatch_allowed',false);
END;
$body$;
REVOKE ALL ON FUNCTION private.prepare_evo_store_provider_attempt(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION private.prepare_evo_store_provider_attempt(uuid) IS
  'Internal preparation only. Does not permit dispatch; follow-up migration must add explicit provider dispatch/recovery authorization.';
COMMIT;
