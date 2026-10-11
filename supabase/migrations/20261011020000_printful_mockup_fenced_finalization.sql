-- PR #189: token-fenced finalization of previously claimed Printful mockup uploads.
-- Existing three-argument RPC is retained only for compatibility with schema
-- references but cannot be executed by API roles after this migration.
-- No Storage uploads or product publication are enabled here.
BEGIN;

REVOKE ALL ON FUNCTION public.complete_evo_store_printful_mockup(uuid,bigint,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.complete_evo_store_printful_mockup(
  p_product_id uuid, p_printful_file_id bigint, p_storage_path text, p_claim_token uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  ledger_row record;
  owned_claim record;
  image_id uuid;
BEGIN
  IF caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=caller AND r.code IN ('admin','super_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PRINTFUL_MEDIA_FORBIDDEN';
  END IF;
  IF p_product_id IS NULL OR p_printful_file_id IS NULL
    OR p_storage_path IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PRINTFUL_MEDIA_INVALID';
  END IF;
  -- Preserve the established lock order: product -> ledger -> upload claim.
  PERFORM 1 FROM public.evo_store_products p
    WHERE p.id=p_product_id
      AND p.publication_status='draft'::public.evo_store_publication_status
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PRINTFUL_MEDIA_DRAFT_REQUIRED';
  END IF;
  SELECT l.* INTO ledger_row
    FROM private.evo_store_printful_mockup_ingestions l
    WHERE l.product_id=p_product_id AND l.printful_file_id=p_printful_file_id
    FOR UPDATE;
  IF NOT FOUND OR ledger_row.storage_path IS DISTINCT FROM p_storage_path
    OR ledger_row.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PRINTFUL_MEDIA_RESERVATION_INVALID';
  END IF;
  SELECT c.* INTO owned_claim
    FROM private.evo_store_printful_upload_claims c
    WHERE c.product_id=p_product_id AND c.printful_file_id=p_printful_file_id
    FOR UPDATE;
  IF NOT FOUND OR owned_claim.storage_path IS DISTINCT FROM p_storage_path
    OR owned_claim.claim_token IS DISTINCT FROM p_claim_token
    OR owned_claim.claimed_by IS DISTINCT FROM caller THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PRINTFUL_MEDIA_CLAIM_INVALID';
  END IF;
  -- Observation deadline is NOT a revocation or takeover deadline.
  SELECT i.id INTO image_id FROM public.evo_store_product_images i
    WHERE i.product_id=p_product_id AND i.storage_bucket='evo-store-products'
      AND i.storage_path=p_storage_path AND i.is_active=false;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PRINTFUL_MEDIA_IMAGE_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.bucket_id='evo-store-products'
      AND o.name=p_storage_path
  ) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PRINTFUL_MEDIA_OBJECT_MISSING';
  END IF;
  UPDATE private.evo_store_printful_mockup_ingestions
    SET status='verified',updated_at=now(),last_error_code=NULL
    WHERE id=ledger_row.id;
  UPDATE public.evo_store_product_images SET is_active=true WHERE id=image_id;
  -- Keep the claim as immutable ownership/audit evidence, no automatic release.
END;
$$;

REVOKE ALL ON FUNCTION public.complete_evo_store_printful_mockup(uuid,bigint,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.complete_evo_store_printful_mockup(uuid,bigint,text,uuid)
  TO authenticated;
COMMIT;
