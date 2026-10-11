-- PR #188: single-owner claim foundation for Printful mockup ingestion.
-- This does NOT enable HTTP uploads or modify existing completion behavior.
-- Claims are deliberately NON-expiring for takeover purposes: a timed-out
-- HTTP call may still be writing. Recovery must be verified separately.
BEGIN;

CREATE TABLE private.evo_store_printful_upload_claims (
  product_id uuid NOT NULL,
  printful_file_id bigint NOT NULL,
  storage_path text NOT NULL,
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  claimed_by uuid NOT NULL REFERENCES public.profiles(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  lease_observation_deadline timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  PRIMARY KEY (product_id, printful_file_id),
  CONSTRAINT evo_store_printful_upload_claim_token_unique UNIQUE (claim_token),
  CONSTRAINT evo_store_printful_upload_claim_product_fk
    FOREIGN KEY (product_id) REFERENCES public.evo_store_products(id) ON DELETE CASCADE
);

ALTER TABLE private.evo_store_printful_upload_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.evo_store_printful_upload_claims
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.claim_evo_store_printful_mockup_upload(
  p_product_id uuid, p_printful_file_id bigint, p_storage_path text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  claim_id uuid;
  ledger_row record;
BEGIN
  IF caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = caller AND r.code IN ('admin','super_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='PRINTFUL_MEDIA_FORBIDDEN';
  END IF;

  IF p_product_id IS NULL OR p_printful_file_id IS NULL OR p_storage_path IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='PRINTFUL_MEDIA_INVALID';
  END IF;

  -- Serialize contenders on the canonical ingestion ledger row.
  SELECT l.* INTO ledger_row
  FROM private.evo_store_printful_mockup_ingestions l
  WHERE l.product_id=p_product_id AND l.printful_file_id=p_printful_file_id
  FOR UPDATE;

  IF NOT FOUND OR ledger_row.status <> 'pending' OR
     ledger_row.storage_path <> p_storage_path THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='PRINTFUL_MEDIA_NOT_RESERVED';
  END IF;

  -- No takeover on timeout: the prior HTTP request might still be in flight.
  IF EXISTS (
    SELECT 1 FROM private.evo_store_printful_upload_claims c
    WHERE c.product_id=p_product_id AND c.printful_file_id=p_printful_file_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55P03', MESSAGE='PRINTFUL_MEDIA_UPLOAD_ALREADY_CLAIMED';
  END IF;

  INSERT INTO private.evo_store_printful_upload_claims
    (product_id,printful_file_id,storage_path,claimed_by)
  VALUES (p_product_id,p_printful_file_id,p_storage_path,caller)
  RETURNING claim_token INTO claim_id;

  RETURN claim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evo_store_printful_mockup_upload(uuid,bigint,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_evo_store_printful_mockup_upload(uuid,bigint,text)
  TO authenticated;

COMMIT;
