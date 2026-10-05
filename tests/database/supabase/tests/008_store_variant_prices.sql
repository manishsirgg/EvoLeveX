BEGIN;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('16000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','prices-admin@example.test','',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id, username)
VALUES ('16000000-0000-4000-8000-000000000001','prices_admin');
INSERT INTO public.roles(id, code, name)
VALUES ('26000000-0000-4000-8000-000000000001','admin','Administrator')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.user_roles(user_id, role_id)
SELECT '16000000-0000-4000-8000-000000000001', id FROM public.roles WHERE code='admin';

SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_categories(id,name,slug,is_active) VALUES
 ('36000000-0000-4000-8000-000000000001','Price Category','price-category',true);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency) VALUES
 ('46000000-0000-4000-8000-000000000001','36000000-0000-4000-8000-000000000001','Draft Prices','price-draft','physical',10,'USD'),
 ('46000000-0000-4000-8000-000000000002','36000000-0000-4000-8000-000000000001','Published Prices','price-published','physical',10,'USD'),
 ('46000000-0000-4000-8000-000000000003','36000000-0000-4000-8000-000000000001','Archived Prices','price-archived','physical',10,'USD'),
 ('46000000-0000-4000-8000-000000000004','36000000-0000-4000-8000-000000000001','Other Draft Prices','price-other-draft','physical',10,'USD');
INSERT INTO public.evo_store_product_images(id,product_id,storage_path,is_primary,is_active) VALUES
 ('66000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000002/66000000-0000-4000-8000-000000000002.jpg',true,true);
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g,is_active) VALUES
 ('56000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','PRICE-DRAFT','Draft',10,'USD',100,true),
 ('56000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000002','PRICE-PUBLISHED','Published',10,'USD',100,true),
 ('56000000-0000-4000-8000-000000000003','46000000-0000-4000-8000-000000000003','PRICE-ARCHIVED','Archived',10,'USD',100,true),
 ('56000000-0000-4000-8000-000000000004','46000000-0000-4000-8000-000000000004','PRICE-OTHER','Other',10,'USD',100,true);
INSERT INTO public.evo_store_variant_prices(id,variant_id,currency,amount,is_active) VALUES
 ('76000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','USD',10,true),
 ('76000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000002','USD',10,true),
 ('76000000-0000-4000-8000-000000000003','56000000-0000-4000-8000-000000000003','USD',10,true),
 ('76000000-0000-4000-8000-000000000004','56000000-0000-4000-8000-000000000004','EUR',10,true);
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand)
VALUES ('56000000-0000-4000-8000-000000000002',1);
UPDATE public.evo_store_products SET publication_status='published'
WHERE id='46000000-0000-4000-8000-000000000002';
UPDATE public.evo_store_products SET publication_status='archived'
WHERE id='46000000-0000-4000-8000-000000000003';
SET CONSTRAINTS ALL IMMEDIATE;

SELECT has_function('private','guard_evo_store_archived_product_variant_prices',ARRAY[]::text[],
  'private price archive guard function exists');
SELECT trigger_is('public','evo_store_variant_prices','evo_store_variant_prices_guard_archived',
  'private','guard_evo_store_archived_product_variant_prices','price archive guard trigger exists');
SELECT ok((SELECT (tgtype & 4)=4 FROM pg_trigger WHERE tgrelid='public.evo_store_variant_prices'::regclass
  AND tgname='evo_store_variant_prices_guard_archived'),'archive guard covers INSERT');
SELECT ok((SELECT (tgtype & 16)=16 FROM pg_trigger WHERE tgrelid='public.evo_store_variant_prices'::regclass
  AND tgname='evo_store_variant_prices_guard_archived'),'archive guard covers UPDATE');
SELECT ok((SELECT (tgtype & 8)=8 FROM pg_trigger WHERE tgrelid='public.evo_store_variant_prices'::regclass
  AND tgname='evo_store_variant_prices_guard_archived'),'archive guard covers DELETE');
SELECT ok((SELECT prosecdef FROM pg_proc
  WHERE oid='private.guard_evo_store_archived_product_variant_prices()'::regprocedure),
  'archive guard is security definer');
SELECT is((SELECT proconfig FROM pg_proc
  WHERE oid='private.guard_evo_store_archived_product_variant_prices()'::regprocedure),
  ARRAY['search_path=""'], 'archive guard has empty search path');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc function
  CROSS JOIN LATERAL aclexplode(coalesce(function.proacl, acldefault('f',function.proowner))) privilege
  WHERE function.oid='private.guard_evo_store_archived_product_variant_prices()'::regprocedure
    AND privilege.grantee=0 AND privilege.privilege_type='EXECUTE'
), 'PUBLIC cannot execute archive guard');
SELECT ok(NOT has_function_privilege('anon','private.guard_evo_store_archived_product_variant_prices()','EXECUTE'),
  'anon cannot execute archive guard');
SELECT ok(NOT has_function_privilege('authenticated','private.guard_evo_store_archived_product_variant_prices()','EXECUTE'),
  'authenticated cannot execute archive guard');
SELECT ok(position('new.variant_id' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variant_prices()'::regprocedure))) > 0,
  'INSERT ownership resolves from NEW.variant_id');
SELECT ok(position('old.variant_id' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variant_prices()'::regprocedure))) > 0,
  'DELETE ownership resolves from OLD.variant_id');
SELECT ok(position('old.variant_id' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variant_prices()'::regprocedure))) > 0
  AND position('new.variant_id' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variant_prices()'::regprocedure))) > 0,
  'UPDATE considers old and new variant ownership');
SELECT ok(position('for update' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variant_prices()'::regprocedure))) > 0,
  'archive guard locks relevant products FOR UPDATE');
SELECT ok(position('order by product.id' in lower(pg_get_functiondef(
  'private.guard_evo_store_archived_product_variant_prices()'::regprocedure))) > 0,
  'archive guard orders distinct product-row locks by UUID');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount)
 VALUES ('56000000-0000-4000-8000-000000000001','EUR',9)$$,'draft price insert remains allowed');
SELECT lives_ok($$UPDATE public.evo_store_variant_prices SET amount=11
 WHERE id='76000000-0000-4000-8000-000000000001'$$,'draft amount update remains allowed');
SELECT lives_ok($$UPDATE public.evo_store_variant_prices SET is_active=true
 WHERE id='76000000-0000-4000-8000-000000000001'$$,'draft activation remains allowed');
SELECT lives_ok($$UPDATE public.evo_store_variant_prices SET is_active=false
 WHERE id='76000000-0000-4000-8000-000000000001'$$,'draft deactivation remains allowed');
SELECT lives_ok($$DELETE FROM public.evo_store_variant_prices
 WHERE variant_id='56000000-0000-4000-8000-000000000001' AND currency='EUR'$$,
 'draft delete remains structurally allowed');
SELECT lives_ok($$INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount)
 VALUES ('56000000-0000-4000-8000-000000000002','EUR',9); SET CONSTRAINTS ALL IMMEDIATE$$,
 'published readiness-safe price insert remains allowed');
SELECT lives_ok($$UPDATE public.evo_store_variant_prices SET amount=12
 WHERE id='76000000-0000-4000-8000-000000000002'; SET CONSTRAINTS ALL IMMEDIATE$$,
 'published readiness-safe amount update remains allowed');

SELECT throws_ok($$INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount)
 VALUES ('56000000-0000-4000-8000-000000000003','EUR',10)$$,
 'P0001','EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT','archived price insert is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variant_prices SET amount=12
 WHERE id='76000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT','archived amount update is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variant_prices SET currency='GBP'
 WHERE id='76000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT','archived currency update is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variant_prices SET is_active=true
 WHERE id='76000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT','archived activation is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variant_prices SET is_active=false
 WHERE id='76000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT','archived deactivation is rejected');
SELECT throws_ok($$DELETE FROM public.evo_store_variant_prices
 WHERE id='76000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT','archived delete is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variant_prices
 SET variant_id='56000000-0000-4000-8000-000000000001'
 WHERE id='76000000-0000-4000-8000-000000000003'$$,
 'P0001','EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT','reassignment from archived parent is rejected');
SELECT throws_ok($$UPDATE public.evo_store_variant_prices
 SET variant_id='56000000-0000-4000-8000-000000000003'
 WHERE id='76000000-0000-4000-8000-000000000004'$$,
 'P0001','EVO_STORE_VARIANT_PRICE_ARCHIVED_PRODUCT','reassignment to archived parent is rejected');
RESET ROLE;

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.evo_store_variant_prices'::regclass),
  'price RLS remains enabled');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='evo_store_variant_prices' AND policyname='evo_store_variant_prices_staff_manage'),
  'price staff policy remains');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='evo_store_variant_prices' AND policyname='evo_store_variant_prices_public_read'),
  'price public visibility policy remains');
SELECT trigger_is('public','evo_store_variant_prices','evo_store_variant_prices_readiness',
  'private','enforce_evo_store_product_readiness','price readiness trigger remains');
SELECT ok((SELECT tgenabled='O' FROM pg_trigger WHERE tgrelid='public.evo_store_variant_prices'::regclass
  AND tgname='evo_store_variant_prices_readiness'),'price readiness trigger remains enabled');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.evo_store_variant_prices'::regclass
  AND conname='evo_store_variant_prices_amount_check'),'amount constraint remains');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.evo_store_variant_prices'::regclass
  AND conname='evo_store_variant_prices_currency_supported_check'),'supported-currency constraint remains');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.evo_store_variant_prices'::regclass
  AND conname='evo_store_variant_prices_jpy_integral_check'),'JPY rule remains');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.evo_store_variant_prices'::regclass
  AND conname='evo_store_variant_prices_variant_currency_key'),'variant/currency uniqueness remains');
SELECT trigger_is('public','evo_store_product_images','evo_store_product_images_guard_archived',
  'private','guard_evo_store_archived_product_images','image archive guard remains');
SELECT trigger_is('public','evo_store_variants','evo_store_variants_guard_archived',
  'private','guard_evo_store_archived_product_variants','variant archive guard remains');

SELECT * FROM finish();
ROLLBACK;
