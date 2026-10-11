# PR #195 — Printful three-color product gallery

This migration installs `public.finalize_evo_store_printful_gallery()`; **installation alone makes no product or image updates**.

## Production prerequisites
- Independently verify all Printful upload flags are false on **Production** (and redeployed): `PRINTFUL_MEDIA_UPLOAD_ENABLED`, `PRINTFUL_FIRST_BLACK_UPLOAD_ENABLED`, `PRINTFUL_NAVY_UPLOAD_ENABLED`, `PRINTFUL_BLUE_UPLOAD_ENABLED`, `PRINTFUL_IMPORT_ENABLED`.
- Confirm product `1dc06ef8-9a2e-419f-9bc3-d3ec06c476e0` remains `draft`, inactive, 18 variants, none active.
- Confirm **exactly** three image metadata rows, mapped in order BLACK (1082848720, 0), MIDNIGHT-NAVY (1082848721, 1), COOL-BLUE (1082848722, 2), all verified, active and backed by Storage objects. No other image rows.
- Confirm database CI on PostgreSQL 15/17 and application tests pass before merging and installing.

## Deployment
1. Copy/run `supabase/migrations/20261011040000_printful_gallery_primary_assignment.sql` in production Supabase SQL Editor. This only defines and grants an admin-only function.
2. Verify its EXECUTE privileges and security definer status. Do not manually edit image rows.
3. To invoke, sign in as an EvoLeveX admin and use an **authenticated RPC client** calling `finalize_evo_store_printful_gallery`. The SQL Editor superuser context cannot satisfy `auth.uid()` without request claims. A supervised, separately reviewed one-shot admin caller may be needed.
4. After invoking, verify read-only: `SELECT i.sort_order,i.is_primary,i.is_active,l.color_code,l.status FROM public.evo_store_product_images i JOIN private.evo_store_printful_mockup_ingestions l ON l.product_id=i.product_id AND l.storage_path=i.storage_path WHERE i.product_id='1dc06ef8-9a2e-419f-9bc3-d3ec06c476e0' ORDER BY i.sort_order;`. Expected Black primary true, Navy/Blue false, all active; ordering 0/1/2.
5. Reverify product remains draft and inactive, 18 variants inactive. This feature does not authorize product publication, prices, fulfillment or stock activation.

## Restrictions
Do not invoke the RPC automatically on deployment; do not expose a general public gallery-modification endpoint. Any failed precondition throws and rolls back. An image row marked active does not imply visibility from a private Storage bucket while the product is unpublished. Publishing/commerce remain out of scope.
