-- PR #192: restrict Printful-mapped Storage objects while preserving ordinary catalog policies.
-- No upload is initiated and no claim is automatically released.
BEGIN;
CREATE FUNCTION private.evo_store_printful_storage_write_permitted(p_path text, p_operation text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  mapped_image record;
BEGIN
  IF p_path IS NULL OR p_operation NOT IN ('insert','update','delete') THEN RETURN false; END IF;
  SELECT i.product_id, i.is_active INTO mapped_image
  FROM public.evo_store_product_images i
  JOIN private.evo_store_printful_product_maps m ON m.product_id=i.product_id
  WHERE i.storage_bucket='evo-store-products' AND i.storage_path=p_path;
  -- Ordinary products retain the existing staff Storage policies.
  IF NOT FOUND THEN RETURN true; END IF;
  -- Once an object belongs to a mapped POD product, no direct UPDATE/DELETE.
  IF p_operation <> 'insert' OR mapped_image.is_active THEN RETURN false; END IF;
  -- Claim ownership is separate from a token: a Storage HTTP request does not
  -- convey the claim token. Token fencing is independently enforced at finalization.
  RETURN EXISTS (
    SELECT 1 FROM private.evo_store_printful_upload_claims c
    JOIN private.evo_store_printful_mockup_ingestions l
      ON l.product_id=c.product_id AND l.printful_file_id=c.printful_file_id
    JOIN public.user_roles ur ON ur.user_id=auth.uid()
    JOIN public.roles r ON r.id=ur.role_id
    WHERE c.product_id=mapped_image.product_id AND c.storage_path=p_path
      AND c.claimed_by=auth.uid()
      AND l.storage_path=p_path AND l.status='pending'
      AND r.code IN ('admin','super_admin')
  );
END;
$$;
REVOKE ALL ON FUNCTION private.evo_store_printful_storage_write_permitted(text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.evo_store_printful_storage_write_permitted(text,text)
 TO authenticated;

CREATE FUNCTION private.evo_store_printful_pending_read_permitted(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.evo_store_product_images i
  JOIN private.evo_store_printful_product_maps m ON m.product_id=i.product_id
  JOIN private.evo_store_printful_upload_claims c ON c.product_id=i.product_id AND c.storage_path=i.storage_path
  JOIN public.user_roles ur ON ur.user_id=auth.uid()
  JOIN public.roles r ON r.id=ur.role_id
  WHERE i.storage_bucket='evo-store-products' AND i.storage_path=p_path
    AND NOT i.is_active AND c.claimed_by=auth.uid()
    AND r.code IN ('admin','super_admin')
);
$$;
REVOKE ALL ON FUNCTION private.evo_store_printful_pending_read_permitted(text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.evo_store_printful_pending_read_permitted(text) TO authenticated;

-- Restrictive policies compose with existing permissive policies, not replace them.
CREATE POLICY evo_printful_storage_claim_insert_guard
 ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (bucket_id <> 'evo-store-products'
   OR private.evo_store_printful_storage_write_permitted(name,'insert'));

CREATE POLICY evo_printful_storage_no_direct_update_guard
 ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (bucket_id <> 'evo-store-products'
   OR private.evo_store_printful_storage_write_permitted(name,'update'))
 WITH CHECK (bucket_id <> 'evo-store-products'
   OR private.evo_store_printful_storage_write_permitted(name,'update'));

CREATE POLICY evo_printful_storage_no_direct_delete_guard
 ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING (bucket_id <> 'evo-store-products'
   OR private.evo_store_printful_storage_write_permitted(name,'delete'));

CREATE POLICY evo_printful_storage_claimed_pending_read
 ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='evo-store-products'
   AND private.evo_store_printful_pending_read_permitted(name));
COMMIT;
