BEGIN;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('15000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','variants-admin@example.test','',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id, username)
VALUES ('15000000-0000-4000-8000-000000000001','variants_admin');
INSERT INTO public.roles(id, code, name)
VALUES ('25000000-0000-4000-8000-000000000001','admin','Administrator')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.user_roles(user_id, role_id)
SELECT '15000000-0000-4000-8000-000000000001', id FROM public.roles WHERE code='admin';

SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_categories(id,name,slug,is_active) VALUES
 ('35000000-0000-4000-8000-000000000001','Variant Category','variant-category',true);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency) VALUES
 ('45000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000001','Draft Variants','variant-draft','physical',10,'USD'),
 ('45000000-0000-4000-8000-000000000002','35000000-0000-4000-8000-000000000001','Published Variants','variant-published','physical',10,'USD'),
 ('45000000-0000-4000-8000-000000000003','35000000-0000-4000-8000-000000000001','Archived Variants','variant-archived','physical',10,'USD');
INSERT INTO public.evo_store_product_images(id,product_id,storage_path,is_primary,is_active) VALUES
 ('65000000-0000-4000-8000-000000000002','45000000-0000-4000-8000-000000000002','45000000-0000-4000-8000-000000000002/65000000-0000-4000-8000-000000000002.jpg',true,true);
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,size_code,color_code,weight_g,is_active,sort_order) VALUES
 ('55000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','DRAFT-BASE','Draft',10,'USD','M','BLUE',100,true,0),
 ('55000000-0000-4000-8000-000000000002','45000000-0000-4000-8000-000000000002','PUBLISHED-BASE','Published',10,'USD','M','BLUE',100,true,0),
 ('55000000-0000-4000-8000-000000000003','45000000-0000-4000-8000-000000000003','ARCHIVED-BASE','Archived',10,'USD','M','BLUE',100,true,0);
INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount)
VALUES ('55000000-0000-4000-8000-000000000002','USD',10);
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand)
VALUES ('55000000-0000-4000-8000-000000000002',1);
UPDATE public.evo_store_products SET publication_status='published'
WHERE id='45000000-0000-4000-8000-000000000002';
UPDATE public.evo_store_products SET publication_status='archived'
WHERE id='45000000-0000-4000-8000-000000000003';
SET CONSTRAINTS ALL IMMEDIATE;

SELECT trigger_is('public','evo_store_variants','evo_store_variants_guard_archived',
  'private','guard_evo_store_archived_product_variants','archive guard trigger exists');
SELECT has_function('private','guard_evo_store_archived_product_variants',ARRAY[]::text[],
  'private archive guard function exists');
SELECT ok((SELECT prosecdef FROM pg_proc
  WHERE oid='private.guard_evo_store_archived_product_variants()'::regprocedure),
  'archive guard is security definer');
SELECT is((SELECT proconfig FROM pg_proc
  WHERE oid='private.guard_evo_store_archived_product_variants()'::regprocedure),
  ARRAY['search_path=""'], 'archive guard has empty search path');
SELECT ok(NOT EXISTS (
  SELECT 1
  FROM pg_proc function
  CROSS JOIN LATERAL aclexplode(coalesce(function.proacl, acldefault('f',function.proowner))) privilege
  WHERE function.oid='private.guard_evo_store_archived_product_variants()'::regprocedure
    AND privilege.grantee=0 AND privilege.privilege_type='EXECUTE'
), 'PUBLIC cannot execute archive guard');
SELECT ok(NOT has_function_privilege('anon','private.guard_evo_store_archived_product_variants()','EXECUTE'),
  'anon cannot execute archive guard');
SELECT ok(NOT has_function_privilege('authenticated','private.guard_evo_store_archived_product_variants()','EXECUTE'),
  'authenticated cannot execute archive guard');
SELECT ok(position('order by product.id' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variants()'::regprocedure))) > 0,
  'archive guard orders parent locks');
SELECT ok(position('for update' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variants()'::regprocedure))) > 0,
  'archive guard locks parents before checking state');
SELECT ok(position('old.product_id' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variants()'::regprocedure))) > 0
  AND position('new.product_id' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variants()'::regprocedure))) > 0,
  'archive guard considers old and new parents');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,size_code,color_code,weight_g)
 VALUES ('55000000-0000-4000-8000-000000000010','45000000-0000-4000-8000-000000000001',' draft-new ','Draft New',10,'USD',' l ',' red ',120)$$,
 'staff may insert a draft variant');
SELECT is((SELECT sku||':'||size_code||':'||color_code FROM public.evo_store_variants
 WHERE id='55000000-0000-4000-8000-000000000010'),'DRAFT-NEW:L:RED','normalization remains active');
SELECT lives_ok($$UPDATE public.evo_store_variants SET weight_g=121,sort_order=2
 WHERE id='55000000-0000-4000-8000-000000000010'$$,'staff may update a draft variant');
SELECT lives_ok($$DELETE FROM public.evo_store_variants
 WHERE id='55000000-0000-4000-8000-000000000010'$$,'staff may delete a draft variant');
SELECT lives_ok($$UPDATE public.evo_store_variants SET sku='PUBLISHED-SAFE'
 WHERE id='55000000-0000-4000-8000-000000000002'; SET CONSTRAINTS ALL IMMEDIATE$$,
 'readiness-safe published mutation remains allowed');

SELECT throws_ok($$INSERT INTO public.evo_store_variants(product_id,sku,name,price,currency)
 VALUES ('45000000-0000-4000-8000-000000000003','ARCHIVED-NEW','No',10,'USD')$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived insert is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET name='No' WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived general update is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET is_active=true WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived activation is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET is_active=false WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived deactivation is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET sku='ARCHIVED-CHANGED' WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived SKU change is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET size_code='L' WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived size change is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET color_code='RED' WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived color change is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET weight_g=101 WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived weight change is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET sort_order=1 WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived sort change is rejected');
SELECT throws_ok($$DELETE FROM public.evo_store_variants WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','archived delete is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET product_id='45000000-0000-4000-8000-000000000001'
 WHERE id='55000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','reassignment from archived parent is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variants SET product_id='45000000-0000-4000-8000-000000000003'
 WHERE id='55000000-0000-4000-8000-000000000001'$$,
 'P0001','EVO_STORE_VARIANT_ARCHIVED_PRODUCT','reassignment to archived parent is rejected');
SELECT throws_ok($$INSERT INTO public.evo_store_variants(product_id,sku,name,price,currency,size_code,color_code)
 VALUES ('45000000-0000-4000-8000-000000000001','PUBLISHED-SAFE','Duplicate',10,'USD','XL','GREEN')$$,
 '23505',NULL,'global normalized SKU uniqueness remains active');
SELECT throws_ok($$INSERT INTO public.evo_store_variants(product_id,sku,name,price,currency,size_code,color_code)
 VALUES ('45000000-0000-4000-8000-000000000001','DRAFT-DIM-DUPE','Duplicate',10,'USD','M','BLUE')$$,
 '23505',NULL,'dimension uniqueness remains active');
RESET ROLE;

SELECT trigger_is('public','evo_store_variants','evo_store_variants_readiness',
  'private','enforce_evo_store_product_readiness','variant readiness trigger remains');
SELECT ok((SELECT tgenabled='O' FROM pg_trigger WHERE tgrelid='public.evo_store_variants'::regclass
  AND tgname='evo_store_variants_readiness'),'variant readiness trigger remains enabled');
SELECT trigger_is('public','evo_store_product_images','evo_store_product_images_guard_archived',
  'private','guard_evo_store_archived_product_images','Phase 2D image guard remains');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.evo_store_variants'::regclass),
  'variant RLS remains enabled');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='evo_store_variants'
  AND policyname='evo_store_variants_staff_manage'),'variant staff policy remains intact');

SELECT * FROM finish();
ROLLBACK;
