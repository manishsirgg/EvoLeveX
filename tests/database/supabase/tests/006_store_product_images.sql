BEGIN;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
 ('14000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','images-member@example.test','',now(),'{}','{}',now(),now()),
 ('14000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','images-admin@example.test','',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id, username) VALUES
 ('14000000-0000-4000-8000-000000000001','images_member'),
 ('14000000-0000-4000-8000-000000000002','images_admin');
INSERT INTO public.roles(id, code, name) VALUES
 ('24000000-0000-4000-8000-000000000001','admin','Administrator') ON CONFLICT (code) DO NOTHING;
INSERT INTO public.user_roles(user_id, role_id)
SELECT '14000000-0000-4000-8000-000000000002', id FROM public.roles WHERE code='admin';

SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_categories(id,name,slug,is_active) VALUES
 ('34000000-0000-4000-8000-000000000001','Image Category','image-category',true);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency) VALUES
 ('44000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000001','Draft Images','image-draft','physical',10,'USD'),
 ('44000000-0000-4000-8000-000000000002','34000000-0000-4000-8000-000000000001','Published Images','image-published','physical',10,'USD'),
 ('44000000-0000-4000-8000-000000000003','34000000-0000-4000-8000-000000000001','Archived Images','image-archived','physical',10,'USD'),
 ('44000000-0000-4000-8000-000000000004','34000000-0000-4000-8000-000000000001','Other Images','image-other','physical',10,'USD');
INSERT INTO public.evo_store_product_images(id,product_id,storage_path,is_primary,is_active) VALUES
 ('64000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000001.jpg',true,true),
 ('64000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000002.jpg',false,true),
 ('64000000-0000-4000-8000-000000000003','44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000003.jpg',false,false),
 ('64000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002/64000000-0000-4000-8000-000000000004.jpg',true,true),
 ('64000000-0000-4000-8000-000000000005','44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002/64000000-0000-4000-8000-000000000005.jpg',false,true),
 ('64000000-0000-4000-8000-000000000006','44000000-0000-4000-8000-000000000003','44000000-0000-4000-8000-000000000003/64000000-0000-4000-8000-000000000006.jpg',true,true),
 ('64000000-0000-4000-8000-000000000007','44000000-0000-4000-8000-000000000004','44000000-0000-4000-8000-000000000004/64000000-0000-4000-8000-000000000007.jpg',true,true);
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g) VALUES
 ('54000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002','IMAGE-PUBLISHED','Published',10,'USD',100);
INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount) VALUES
 ('54000000-0000-4000-8000-000000000002','USD',10);
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand) VALUES
 ('54000000-0000-4000-8000-000000000002',1);
UPDATE public.evo_store_products SET publication_status='published' WHERE id='44000000-0000-4000-8000-000000000002';
UPDATE public.evo_store_products SET publication_status='archived' WHERE id='44000000-0000-4000-8000-000000000003';
SET CONSTRAINTS ALL IMMEDIATE;

INSERT INTO storage.objects(bucket_id,name) VALUES
 ('evo-store-products','44000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000001.jpg'),
 ('evo-store-products','44000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000003.jpg'),
 ('evo-store-products','44000000-0000-4000-8000-000000000002/64000000-0000-4000-8000-000000000004.jpg');

SELECT ok(NOT (SELECT public FROM storage.buckets WHERE id='evo-store-products'), 'bucket remains private');
SELECT is((SELECT file_size_limit FROM storage.buckets WHERE id='evo-store-products'), 5242880::bigint, 'bucket enforces the 5 MiB object limit');
SELECT is((SELECT allowed_mime_types FROM storage.buckets WHERE id='evo-store-products'), ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[], 'MIME allowlist is unchanged');
SELECT has_index('public','evo_store_product_images','evo_store_product_images_one_active_primary_idx','primary uniqueness remains');
SELECT trigger_is('public','evo_store_product_images','evo_store_product_images_readiness','private','enforce_evo_store_product_readiness','readiness trigger remains');
SELECT trigger_is('public','evo_store_product_images','evo_store_product_images_guard_archived','private','guard_evo_store_archived_product_images','archive guard exists');
SELECT ok((SELECT tgenabled='O' FROM pg_trigger WHERE tgrelid='public.evo_store_product_images'::regclass AND tgname='evo_store_product_images_readiness'), 'readiness trigger is enabled');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.set_evo_store_product_primary_image(uuid,uuid)'::regprocedure), 'primary RPC is security definer');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid='public.set_evo_store_product_primary_image(uuid,uuid)'::regprocedure), ARRAY['search_path=""'], 'primary RPC has empty search path');
SELECT ok(NOT has_function_privilege('anon','public.set_evo_store_product_primary_image(uuid,uuid)','EXECUTE'), 'anon lacks RPC execute');
SELECT ok(has_function_privilege('authenticated','public.set_evo_store_product_primary_image(uuid,uuid)','EXECUTE'), 'authenticated receives guarded RPC execute');
SELECT like(pg_get_functiondef('private.guard_evo_store_archived_product_images()'::regprocedure), '%FOR UPDATE%', 'archive guard locks parent rows');
SELECT like(pg_get_functiondef('public.set_evo_store_product_primary_image(uuid,uuid)'::regprocedure), '%FOR UPDATE%', 'primary RPC locks the product row');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='evo-store-products'), 1::bigint, 'ordinary member sees only the published active object');
SELECT throws_ok($$SELECT public.set_evo_store_product_primary_image('44000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002')$$, '42501', 'EVO_STORE_IMAGE_PRIMARY_UNAUTHORIZED', 'ordinary member cannot transition primary');
SELECT set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='evo-store-products'), 3::bigint, 'staff sees draft and inactive objects');
SELECT lives_ok($$INSERT INTO storage.objects(bucket_id,name) VALUES ('evo-store-products','44000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000002.jpg')$$, 'staff upload accepts prepared draft metadata');
SELECT throws_ok($$INSERT INTO storage.objects(bucket_id,name) VALUES ('evo-store-products','44000000-0000-4000-8000-000000000003/64000000-0000-4000-8000-000000000006.jpg')$$, '42501', NULL, 'archived metadata cannot authorize upload');
SELECT throws_ok($$INSERT INTO storage.objects(bucket_id,name) VALUES ('evo-store-products','arbitrary/path.jpg')$$, '42501', NULL, 'arbitrary path cannot authorize upload');

SELECT throws_ok($$INSERT INTO public.evo_store_product_images(product_id,storage_path) VALUES ('44000000-0000-4000-8000-000000000003','44000000-0000-4000-8000-000000000003/64000000-0000-4000-8000-000000000008.jpg')$$, 'P0001', 'EVO_STORE_IMAGE_ARCHIVED_PRODUCT', 'archived image insert is rejected');
SELECT throws_ok($$UPDATE public.evo_store_product_images SET alt_text='no' WHERE id='64000000-0000-4000-8000-000000000006'$$, 'P0001', 'EVO_STORE_IMAGE_ARCHIVED_PRODUCT', 'archived image update is rejected');
SELECT throws_ok($$DELETE FROM public.evo_store_product_images WHERE id='64000000-0000-4000-8000-000000000006'$$, 'P0001', 'EVO_STORE_IMAGE_ARCHIVED_PRODUCT', 'archived image delete is rejected');
SELECT lives_ok($$UPDATE public.evo_store_product_images SET alt_text='draft allowed' WHERE id='64000000-0000-4000-8000-000000000001'$$, 'draft metadata remains mutable');
SELECT lives_ok($$UPDATE public.evo_store_product_images SET alt_text='published allowed' WHERE id='64000000-0000-4000-8000-000000000004'$$, 'readiness-safe published metadata remains mutable');
SELECT is((SELECT count(*) FROM public.evo_store_product_images WHERE id='64000000-0000-4000-8000-000000000006'), 1::bigint, 'staff can still read archived metadata');

SELECT throws_ok($$SELECT public.set_evo_store_product_primary_image('ffffffff-ffff-4fff-8fff-ffffffffffff','64000000-0000-4000-8000-000000000002')$$, 'P0002', 'EVO_STORE_IMAGE_PRIMARY_PRODUCT_NOT_FOUND', 'missing product rejected');
SELECT throws_ok($$SELECT public.set_evo_store_product_primary_image('44000000-0000-4000-8000-000000000003','64000000-0000-4000-8000-000000000006')$$, 'P0001', 'EVO_STORE_IMAGE_ARCHIVED_PRODUCT', 'archived product rejected');
SELECT throws_ok($$SELECT public.set_evo_store_product_primary_image('44000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000007')$$, 'P0002', 'EVO_STORE_IMAGE_PRIMARY_IMAGE_NOT_FOUND', 'cross-product image rejected');
SELECT throws_ok($$SELECT public.set_evo_store_product_primary_image('44000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000003')$$, 'P0001', 'EVO_STORE_IMAGE_PRIMARY_INACTIVE', 'inactive target rejected');
SELECT lives_ok($$SELECT public.set_evo_store_product_primary_image('44000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002')$$, 'draft primary transition succeeds');
SELECT lives_ok($$SELECT public.set_evo_store_product_primary_image('44000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000005'); SET CONSTRAINTS ALL IMMEDIATE$$, 'published primary transition succeeds atomically');
SELECT is((SELECT count(*) FROM public.evo_store_product_images WHERE product_id='44000000-0000-4000-8000-000000000002' AND is_active AND is_primary), 1::bigint, 'published product has exactly one active primary');
SELECT is((SELECT is_active::text||':'||is_primary::text FROM public.evo_store_product_images WHERE id='64000000-0000-4000-8000-000000000004'), 'true:false', 'old primary stays active and is cleared');
SELECT is((SELECT is_active::text||':'||is_primary::text FROM public.evo_store_product_images WHERE id='64000000-0000-4000-8000-000000000005'), 'true:true', 'target stays active and becomes primary');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='evo-store-products'), 1::bigint, 'anonymous read remains publication scoped');
RESET ROLE;
SELECT throws_ok($$INSERT INTO public.evo_store_product_images(product_id,storage_path) VALUES ('44000000-0000-4000-8000-000000000001','wrong/64000000-0000-4000-8000-000000000009.jpg')$$, '23514', NULL, 'path constraint remains authoritative');

SELECT * FROM finish();
ROLLBACK;
