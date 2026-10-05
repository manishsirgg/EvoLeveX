BEGIN;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
 ('13000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','management-member@example.test','',now(),'{}','{}',now(),now()),
 ('13000000-0000-4000-8000-000000000002','00000000-0000-0000-8000-000000000000','authenticated','authenticated','management-admin@example.test','',now(),'{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles(id, username) VALUES
 ('13000000-0000-4000-8000-000000000001','management_member'),
 ('13000000-0000-4000-8000-000000000002','management_admin') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles(id, code, name) VALUES
 ('23000000-0000-4000-8000-000000000001','admin','Administrator') ON CONFLICT (code) DO NOTHING;
INSERT INTO public.user_roles(user_id, role_id)
SELECT '13000000-0000-4000-8000-000000000002', id FROM public.roles WHERE code='admin'
ON CONFLICT DO NOTHING;

SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_categories(id,name,slug,is_active) VALUES
 ('33000000-0000-4000-8000-000000000001','Management Active','management-active',true),
 ('33000000-0000-4000-8000-000000000002','Management Inactive','management-inactive',false);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency,publication_status) VALUES
 ('43000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','Complete Draft','management-complete','physical',10,'USD','draft'),
 ('43000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000002','Broken Draft','management-broken','physical',10,'USD','draft'),
 ('43000000-0000-4000-8000-000000000003','33000000-0000-4000-8000-000000000001','Published','management-published','physical',10,'USD','draft'),
 ('43000000-0000-4000-8000-000000000004','33000000-0000-4000-8000-000000000001','Archived','management-archived','physical',10,'USD','archived');
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g,size_code,is_active) VALUES
 ('53000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','MGMT-COMPLETE','Complete',10,'USD',100,null,true),
 ('53000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','MGMT-BROKEN','Broken',10,'USD',null,null,true),
 ('53000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000003','MGMT-PUBLISHED','Published',10,'USD',100,null,true),
 ('53000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000003','MGMT-INACTIVE','Inactive',10,'USD',100,'INACTIVE',false),
 ('53000000-0000-4000-8000-000000000005','43000000-0000-4000-8000-000000000004','MGMT-ARCHIVED','Archived',10,'USD',100,null,true),
 ('53000000-0000-4000-8000-000000000006','43000000-0000-4000-8000-000000000001','MGMT-RPC','RPC',10,'USD',100,'RPC',false),
 ('53000000-0000-4000-8000-000000000007','43000000-0000-4000-8000-000000000001','MGMT-ZERO','Zero',10,'USD',100,'ZERO',false);
INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount) VALUES
 ('53000000-0000-4000-8000-000000000001','USD',10),
 ('53000000-0000-4000-8000-000000000003','USD',10),
 ('53000000-0000-4000-8000-000000000004','USD',10),
 ('53000000-0000-4000-8000-000000000005','USD',10);
INSERT INTO public.evo_store_product_images(id,product_id,storage_path,is_primary) VALUES
 ('63000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001/63000000-0000-4000-8000-000000000001.jpg',true),
 ('63000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000003/63000000-0000-4000-8000-000000000003.jpg',true),
 ('63000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000004/63000000-0000-4000-8000-000000000004.jpg',true);
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand) VALUES
 ('53000000-0000-4000-8000-000000000001',1),
 ('53000000-0000-4000-8000-000000000003',4),
 ('53000000-0000-4000-8000-000000000004',4),
 ('53000000-0000-4000-8000-000000000005',4);
UPDATE public.evo_store_products SET publication_status='published' WHERE id='43000000-0000-4000-8000-000000000003';
SET CONSTRAINTS ALL IMMEDIATE;

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.evo_store_inventory'::regclass), 'inventory RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.evo_store_inventory_movements'::regclass), 'movement RLS enabled');
SELECT ok(has_table_privilege('authenticated','public.evo_store_inventory','SELECT'), 'authenticated has inventory SELECT');
SELECT ok(NOT has_table_privilege('authenticated','public.evo_store_inventory','INSERT,UPDATE,DELETE'), 'authenticated lacks inventory writes');
SELECT ok(NOT has_table_privilege('anon','public.evo_store_inventory','SELECT'), 'anon lacks inventory SELECT');
SELECT ok(has_table_privilege('authenticated','public.evo_store_inventory_movements','SELECT'), 'authenticated has movement SELECT');
SELECT ok(NOT has_table_privilege('authenticated','public.evo_store_inventory_movements','INSERT,UPDATE,DELETE'), 'authenticated lacks movement writes');
SELECT ok(NOT has_table_privilege('anon','public.evo_store_inventory_movements','SELECT'), 'anon lacks movement SELECT');
SELECT ok(has_table_privilege('service_role','public.evo_store_inventory','TRUNCATE,REFERENCES,TRIGGER'), 'baseline service role inventory privileges are preserved');
SELECT ok(has_table_privilege('service_role','public.evo_store_inventory_movements','TRUNCATE,REFERENCES,TRIGGER'), 'baseline service role movement privileges are preserved');

SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.inspect_evo_store_product_readiness(uuid)'::regprocedure), 'inspection is security definer');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure), 'adjustment is security definer');
SELECT ok((SELECT prosecdef AND provolatile='s' FROM pg_proc WHERE oid='public.get_evo_store_variant_availability(uuid[])'::regprocedure), 'availability is stable security definer');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid='public.inspect_evo_store_product_readiness(uuid)'::regprocedure), ARRAY['search_path=""'], 'inspection search path is empty');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid='public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure), ARRAY['search_path=""'], 'adjustment search path is empty');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid='public.get_evo_store_variant_availability(uuid[])'::regprocedure), ARRAY['search_path=""'], 'availability search path is empty');
SELECT ok(NOT has_function_privilege('anon','public.inspect_evo_store_product_readiness(uuid)','EXECUTE'), 'anon cannot execute inspection');
SELECT ok(NOT has_function_privilege('anon','public.adjust_evo_store_inventory(uuid,text,integer,text)','EXECUTE'), 'anon cannot execute adjustment');
SELECT ok(has_function_privilege('anon','public.get_evo_store_variant_availability(uuid[])','EXECUTE'), 'anon can execute availability');
SELECT is(pg_get_function_result('public.get_evo_store_variant_availability(uuid[])'::regprocedure), 'TABLE(variant_id uuid, availability text)', 'availability projection is minimal');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT count(*) FROM public.evo_store_inventory), 0::bigint, 'ordinary user sees no inventory');
SELECT is((SELECT count(*) FROM public.evo_store_inventory_movements), 0::bigint, 'ordinary user sees no movements');
SELECT throws_ok($$SELECT * FROM public.inspect_evo_store_product_readiness('43000000-0000-4000-8000-000000000001')$$, '42501', 'staff access required', 'ordinary user cannot inspect');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','initialize',2,'initial_stock')$$, '42501', 'staff access required', 'ordinary user cannot mutate');

SELECT set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*) FROM public.evo_store_inventory), 4::bigint, 'staff reads inventory');
SELECT is((SELECT count(*) FROM public.inspect_evo_store_product_readiness('43000000-0000-4000-8000-000000000001')), 0::bigint, 'complete draft is ready');
SELECT set_eq(
  $$SELECT code FROM public.inspect_evo_store_product_readiness('43000000-0000-4000-8000-000000000002')$$,
  $$VALUES ('EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED'), ('EVO_STORE_READY_IMAGE_REQUIRED'),
           ('EVO_STORE_READY_PRIMARY_IMAGE_REQUIRED'), ('EVO_STORE_READY_VARIANT_WEIGHT_REQUIRED'),
           ('EVO_STORE_READY_VARIANT_INVENTORY_REQUIRED'), ('EVO_STORE_READY_VARIANT_PRICE_REQUIRED')$$,
  'inspection reports all applicable Stage 1A failures');
SELECT throws_ok($$UPDATE public.evo_store_products SET publication_status='published' WHERE id='43000000-0000-4000-8000-000000000002'; SET CONSTRAINTS ALL IMMEDIATE$$,
  'P0001', 'EVO_STORE_READY_ACTIVE_CATEGORY_REQUIRED', 'inspection agrees with authoritative publication enforcement');
SELECT is((SELECT code FROM public.inspect_evo_store_product_readiness('ffffffff-ffff-4fff-8fff-ffffffffffff')), 'EVO_STORE_READY_PRODUCT_NOT_FOUND', 'missing product has stable code');

SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','initialize',5,'initial_stock')$$, 'staff initializes inventory');
SELECT is((SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='53000000-0000-4000-8000-000000000006'), 5, 'initialize sets on hand');
SELECT is((SELECT count(*) FROM public.evo_store_inventory_movements WHERE variant_id='53000000-0000-4000-8000-000000000006'), 1::bigint, 'nonzero initialize writes one movement');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','initialize',1,'initial_stock')$$, '23505', NULL, 'duplicate initialize rejected');
SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000007','initialize',0,'initial_stock')$$, 'zero initialize is allowed');
SELECT is((SELECT count(*) FROM public.evo_store_inventory_movements WHERE variant_id='53000000-0000-4000-8000-000000000007'), 0::bigint, 'zero initialize omits movement');
SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','adjust',3,'stock_received')$$, 'positive adjustment succeeds');
SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','adjust',-2,'damage')$$, 'negative adjustment succeeds');
SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','set',9,'stock_count')$$, 'absolute set succeeds');
SELECT is((SELECT quantity_on_hand::text||':'||quantity_reserved::text FROM public.evo_store_inventory WHERE variant_id='53000000-0000-4000-8000-000000000006'), '9:0', 'mutations preserve reserved stock');
SELECT bag_eq(
  $$SELECT quantity_change, reason FROM public.evo_store_inventory_movements WHERE variant_id='53000000-0000-4000-8000-000000000006'$$,
  $$VALUES (5, 'initial_stock'), (3, 'stock_received'), (-2, 'damage'), (3, 'stock_count')$$,
  'each movement records actual delta and reason');
SELECT ok((SELECT bool_and(created_by='13000000-0000-4000-8000-000000000002') FROM public.evo_store_inventory_movements WHERE variant_id='53000000-0000-4000-8000-000000000006'), 'movements attribute auth uid');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','adjust',0,'manual_correction')$$, '22023', 'adjust quantity must be non-zero', 'zero adjust rejected');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','set',9,'stock_count')$$, '22023', 'set quantity must change stock', 'zero-delta set rejected');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','adjust',-10,'loss')$$, '22023', 'resulting stock cannot be negative', 'negative result rejected');
RESET ROLE;
UPDATE public.evo_store_inventory SET quantity_reserved=4 WHERE variant_id='53000000-0000-4000-8000-000000000006';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','set',3,'stock_count')$$, '22023', 'resulting stock cannot be below reserved stock', 'below-reserved set rejected');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','wat',3,'stock_count')$$, '22023', 'invalid inventory mode', 'invalid mode rejected');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','adjust',1,'order')$$, '22023', 'invalid inventory reason', 'invalid reason rejected');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('ffffffff-ffff-4fff-8fff-ffffffffffff','initialize',1,'initial_stock')$$, '23503', 'inventory variant does not exist', 'missing variant rejected');
SELECT throws_ok($$INSERT INTO public.evo_store_inventory(variant_id) VALUES ('53000000-0000-4000-8000-000000000006')$$, '42501', NULL, 'staff has no direct inventory write');
RESET ROLE;

CREATE FUNCTION pg_temp.reject_management_movement() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic movement failure'; END$$;
CREATE TRIGGER reject_management_movement BEFORE INSERT ON public.evo_store_inventory_movements
FOR EACH ROW WHEN (NEW.reason = 'manual_correction') EXECUTE FUNCTION pg_temp.reject_management_movement();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('53000000-0000-4000-8000-000000000006','adjust',1,'manual_correction')$$, 'P0001', 'synthetic movement failure', 'movement failure propagates');
SELECT is((SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='53000000-0000-4000-8000-000000000006'), 9, 'movement failure rolls back stock update');
RESET ROLE;
DROP TRIGGER reject_management_movement ON public.evo_store_inventory_movements;

SET LOCAL ROLE anon;
SELECT set_eq(
 $$SELECT variant_id::text||':'||availability FROM public.get_evo_store_variant_availability(ARRAY[
 '53000000-0000-4000-8000-000000000003'::uuid,'53000000-0000-4000-8000-000000000003'::uuid,
 '53000000-0000-4000-8000-000000000004'::uuid,'53000000-0000-4000-8000-000000000005'::uuid,
 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid])$$,
 $$VALUES ('53000000-0000-4000-8000-000000000003:in_stock'),
          ('53000000-0000-4000-8000-000000000004:unavailable'),
          ('53000000-0000-4000-8000-000000000005:unavailable'),
          ('ffffffff-ffff-4fff-8fff-ffffffffffff:unavailable')$$,
 'availability is public, deterministic, deduplicated, and hides inactive/archived/missing variants');
SELECT is((SELECT count(*) FROM public.get_evo_store_variant_availability(NULL)), 0::bigint, 'NULL input returns no rows');
SELECT is((SELECT count(*) FROM public.get_evo_store_variant_availability(ARRAY[]::uuid[])), 0::bigint, 'empty input returns no rows');
RESET ROLE;
UPDATE public.evo_store_inventory SET quantity_on_hand=quantity_reserved WHERE variant_id='53000000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
SELECT is((SELECT availability FROM public.get_evo_store_variant_availability(ARRAY['53000000-0000-4000-8000-000000000003'::uuid])), 'out_of_stock', 'authenticated sees boolean-like out-of-stock state without counts');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
