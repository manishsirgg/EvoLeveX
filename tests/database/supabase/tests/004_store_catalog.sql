BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(49);

SELECT has_type('public', 'evo_store_publication_status', 'Store publication enum exists');
SELECT has_table('public', 'evo_store_product_images', 'Store product images exist');
SELECT has_table('public', 'evo_store_variant_prices', 'Store variant prices exist');
SELECT has_column('public', 'evo_store_products', 'publication_status', 'products have publication status');
SELECT has_column('public', 'evo_store_variants', 'size_code', 'variants have normalized size');
SELECT has_column('public', 'evo_store_variants', 'color_code', 'variants have normalized color');
SELECT has_index('public', 'evo_store_product_images', 'evo_store_product_images_one_active_primary_idx', 'one-active-primary index exists');
SELECT has_index('public', 'evo_store_product_images', 'evo_store_product_images_product_order_idx', 'deterministic image ordering index exists');
SELECT has_index('public', 'evo_store_variant_prices', 'evo_store_variant_prices_variant_currency_key', 'variant/currency uniqueness exists');
SELECT trigger_is('public', 'evo_store_products', 'evo_store_products_project_is_active', 'private', 'project_evo_store_product_is_active', 'is_active projection trigger exists');
SELECT trigger_is('public', 'evo_store_variants', 'evo_store_variants_normalize_codes', 'private', 'normalize_evo_store_variant_codes', 'variant normalization trigger exists');
SELECT ok((SELECT NOT public FROM storage.buckets WHERE id = 'evo-store-products'), 'Store image bucket is private');
SELECT is((SELECT allowed_mime_types FROM storage.buckets WHERE id = 'evo-store-products'),
  ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[], 'bucket restricts approved image MIME types');

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
 ('11000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','store-member@example.test','',now(),'{}','{}',now(),now()),
 ('11000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','store-admin@example.test','',now(),'{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles(id, username) VALUES
 ('11000000-0000-4000-8000-000000000001','store_member'),
 ('11000000-0000-4000-8000-000000000002','store_admin') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles(id, code, name) VALUES
 ('21000000-0000-4000-8000-000000000001','admin','Administrator') ON CONFLICT (code) DO NOTHING;
INSERT INTO public.user_roles(user_id, role_id)
SELECT '11000000-0000-4000-8000-000000000002', id FROM public.roles WHERE code='admin'
ON CONFLICT DO NOTHING;

SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_categories(id,name,slug,is_active) VALUES
 ('31000000-0000-4000-8000-000000000001','Active Store','active-store',true),
 ('31000000-0000-4000-8000-000000000002','Inactive Store','inactive-store',false);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency,publication_status) VALUES
 ('41000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','Ready Shirt','ready-shirt','physical',20,'USD','draft'),
 ('41000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001','Archived Shirt','archived-shirt','physical',20,'USD','archived'),
 ('41000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000002','Bad Category Shirt','bad-category-shirt','physical',20,'USD','draft');

SELECT is((SELECT is_active FROM public.evo_store_products WHERE id='41000000-0000-4000-8000-000000000001'), false, 'draft projects inactive');
SELECT is((SELECT is_active FROM public.evo_store_products WHERE id='41000000-0000-4000-8000-000000000002'), false, 'archive projects inactive');

SELECT throws_ok($$INSERT INTO public.evo_store_variants(product_id,sku,name,price,currency) VALUES
 ('41000000-0000-4000-8000-000000000001','   ','Blank',20,'USD')$$, '23514', NULL, 'blank SKU is rejected');
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g,size_code,color_code,sort_order) VALUES
 ('51000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001',' shirt-black-m ','Black M',20,'USD',250,' m ',' black ',1);
SELECT is((SELECT sku FROM public.evo_store_variants WHERE id='51000000-0000-4000-8000-000000000001'), 'SHIRT-BLACK-M', 'SKU is canonicalized');
SELECT is((SELECT size_code||':'||color_code FROM public.evo_store_variants WHERE id='51000000-0000-4000-8000-000000000001'), 'M:BLACK', 'dimensions are canonicalized');
SELECT throws_ok($$INSERT INTO public.evo_store_variants(product_id,sku,name,price,currency,size_code) VALUES
 ('41000000-0000-4000-8000-000000000001','BAD SIZE','Bad',20,'USD','M space')$$, '23514', NULL, 'invalid SKU/dimension input is rejected');
SELECT throws_ok($$INSERT INTO public.evo_store_variants(product_id,sku,name,price,currency,size_code,color_code) VALUES
 ('41000000-0000-4000-8000-000000000001','SHIRT-DUP','Duplicate',20,'USD','M','BLACK')$$, '23505', NULL, 'duplicate normalized combination is rejected');
SELECT throws_ok($$INSERT INTO public.evo_store_variants(product_id,sku,name,price,currency) VALUES
 ('41000000-0000-4000-8000-000000000002','SHIRT-BLACK-M','Duplicate SKU',20,'USD')$$, '23505', NULL, 'SKU remains globally unique');

INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g) VALUES
 ('51000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002','ARCHIVE-DEFAULT','Default',20,'USD',200);
SELECT throws_ok($$INSERT INTO public.evo_store_variants(product_id,sku,name,price,currency,weight_g) VALUES
 ('41000000-0000-4000-8000-000000000002','ARCHIVE-DEFAULT-2','Second default',20,'USD',200)$$, '23505', NULL, 'only one NULL/NULL default variant is allowed');

SELECT throws_ok($$INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount) VALUES
 ('51000000-0000-4000-8000-000000000001','CHF',10)$$, '23514', NULL, 'unsupported configured currency is rejected');
SELECT throws_ok($$INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount) VALUES
 ('51000000-0000-4000-8000-000000000001','JPY',100.50)$$, '23514', NULL, 'fractional JPY is rejected');
INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount,is_active) VALUES
 ('51000000-0000-4000-8000-000000000001','USD',0,true),
 ('51000000-0000-4000-8000-000000000001','JPY',100,true),
 ('51000000-0000-4000-8000-000000000001','EUR',15,false);
SELECT lives_ok($$UPDATE public.evo_store_variant_prices SET amount=0 WHERE variant_id='51000000-0000-4000-8000-000000000001' AND currency='USD'$$, 'zero draft price is structurally valid');
SELECT throws_ok($$INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount) VALUES
 ('51000000-0000-4000-8000-000000000001','JPY',200)$$, '23505', NULL, 'variant/currency configured price is unique');

SELECT throws_ok($$INSERT INTO public.evo_store_product_images(product_id,storage_path) VALUES
 ('41000000-0000-4000-8000-000000000001','other/61000000-0000-4000-8000-000000000001.jpg')$$, '23514', NULL, 'cross-product image path is rejected');
SELECT throws_ok($$INSERT INTO public.evo_store_product_images(product_id,storage_path) VALUES
 ('41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001/61000000-0000-4000-8000-000000000001.gif')$$, '23514', NULL, 'unapproved image extension is rejected');
INSERT INTO public.evo_store_product_images(id,product_id,storage_path,alt_text,sort_order,is_primary) VALUES
 ('61000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001/61000000-0000-4000-8000-000000000001.jpg','Front',2,true),
 ('61000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001/61000000-0000-4000-8000-000000000002.webp','Back',1,false);
SELECT throws_ok($$INSERT INTO public.evo_store_product_images(product_id,storage_path,is_primary) VALUES
 ('41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001/61000000-0000-4000-8000-000000000003.png',true)$$, '23505', NULL, 'second active primary image is rejected');
SELECT is((SELECT string_agg(id::text, ',' ORDER BY sort_order,created_at,id) FROM public.evo_store_product_images WHERE product_id='41000000-0000-4000-8000-000000000001'),
  '61000000-0000-4000-8000-000000000002,61000000-0000-4000-8000-000000000001', 'image ordering is deterministic');

INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand) VALUES
 ('51000000-0000-4000-8000-000000000001',0);
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,size_code,is_active) VALUES
 ('51000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000001','SHIRT-INACTIVE-L','Inactive L',20,'USD','L',false);
UPDATE public.evo_store_products SET publication_status='published' WHERE id='41000000-0000-4000-8000-000000000001';
SET CONSTRAINTS ALL IMMEDIATE;
SELECT is((SELECT is_active FROM public.evo_store_products WHERE id='41000000-0000-4000-8000-000000000001'), true, 'published projects active');

SET LOCAL ROLE anon;
SELECT is((SELECT count(*) FROM public.evo_store_products), 1::bigint, 'anon sees only published product');
SELECT is((SELECT count(*) FROM public.evo_store_variants), 1::bigint, 'anon sees only active published variant');
SELECT is((SELECT count(*) FROM public.evo_store_product_images), 2::bigint, 'anon sees active published images');
SELECT is((SELECT count(*) FROM public.evo_store_variant_prices), 2::bigint, 'anon sees active published prices');
SELECT throws_ok($$SELECT count(*) FROM public.evo_store_inventory$$, '42501', NULL, 'anon cannot inspect raw inventory');
RESET ROLE;

UPDATE public.evo_store_product_images SET is_active=false WHERE id='61000000-0000-4000-8000-000000000002';
SET LOCAL ROLE anon;
SELECT is((SELECT count(*) FROM public.evo_store_product_images), 1::bigint, 'inactive image is hidden');
RESET ROLE;
UPDATE public.evo_store_product_images SET is_active=true WHERE id='61000000-0000-4000-8000-000000000002';

SELECT throws_ok($$UPDATE public.evo_store_product_images SET is_active=false WHERE is_primary AND product_id='41000000-0000-4000-8000-000000000001'; SET CONSTRAINTS ALL IMMEDIATE$$,
  'P0001', 'EVO_STORE_READY_PRIMARY_IMAGE_REQUIRED', 'published product cannot lose primary image');
SELECT throws_ok($$UPDATE public.evo_store_variant_prices SET amount=0 WHERE variant_id='51000000-0000-4000-8000-000000000001'; SET CONSTRAINTS ALL IMMEDIATE$$,
  'P0001', 'EVO_STORE_READY_VARIANT_PRICE_REQUIRED', 'zero configured prices cannot keep product published');
SELECT throws_ok($$DELETE FROM public.evo_store_inventory WHERE variant_id='51000000-0000-4000-8000-000000000001'; SET CONSTRAINTS ALL IMMEDIATE$$,
  'P0001', 'EVO_STORE_READY_VARIANT_INVENTORY_REQUIRED', 'published variant requires inventory row');
SELECT throws_ok($$UPDATE public.evo_store_variants SET weight_g=NULL WHERE id='51000000-0000-4000-8000-000000000001'; SET CONSTRAINTS ALL IMMEDIATE$$,
  'P0001', 'EVO_STORE_READY_VARIANT_WEIGHT_REQUIRED', 'published physical variant requires weight');
SELECT throws_ok($$UPDATE public.evo_store_categories SET is_active=false WHERE id='31000000-0000-4000-8000-000000000001'; SET CONSTRAINTS ALL IMMEDIATE$$,
  'P0001', 'EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED', 'inactive category cannot retain published product');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
SELECT throws_ok($$INSERT INTO public.evo_store_products(name,slug,base_price,currency) VALUES ('Denied','denied',1,'USD')$$,
  '42501', NULL, 'nonstaff cannot create Store products');
SELECT set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
SELECT ok(private.is_staff(), 'admin identity is staff');
SELECT lives_ok($$INSERT INTO public.evo_store_products(name,slug,base_price,currency) VALUES ('Staff Draft','staff-draft',1,'USD')$$,
  'staff can manage Store drafts');
RESET ROLE;

SELECT is((SELECT base_price::text||':'||currency::text FROM public.evo_store_products WHERE id='41000000-0000-4000-8000-000000000001'), '20.00:USD', 'legacy product price fields remain readable');
SELECT is((SELECT price::text||':'||currency::text FROM public.evo_store_variants WHERE id='51000000-0000-4000-8000-000000000001'), '20.00:USD', 'legacy variant price fields remain readable');
SELECT is((SELECT amount FROM public.evo_store_variant_prices WHERE variant_id='51000000-0000-4000-8000-000000000001' AND currency='USD'), 0.00::numeric, 'configured price does not synchronize legacy variant price');

SELECT throws_ok($$INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency,publication_status)
 VALUES ('41000000-0000-4000-8000-000000000004','31000000-0000-4000-8000-000000000001','Incomplete','incomplete','physical',1,'USD','published'); SET CONSTRAINTS ALL IMMEDIATE$$,
 'P0001', 'EVO_STORE_READY_IMAGE_REQUIRED', 'incomplete product cannot publish');

SELECT * FROM finish();
ROLLBACK;
