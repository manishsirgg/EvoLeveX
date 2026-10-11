-- Record the previously audited production permissions in version control.
-- No data mutation, no publishing, and no new public access to draft assets.
BEGIN;

GRANT SELECT ON TABLE public.evo_store_inventory TO authenticated;

DROP POLICY IF EXISTS evo_store_product_objects_staff_read ON storage.objects;
CREATE POLICY evo_store_product_objects_staff_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evo-store-products'
  AND (SELECT private.is_staff())
  AND EXISTS (
    SELECT 1 FROM public.evo_store_product_images image
    WHERE image.storage_bucket = storage.objects.bucket_id
      AND image.storage_path = storage.objects.name
  )
);

COMMIT;
