BEGIN;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

INSERT INTO auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES
 ('17000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inventory-admin@example.test','',now(),'{}','{}',now(),now()),
 ('17000000-0000-4000-8000-000000000002','00000000-0000-0000-8000-000000000000','authenticated','authenticated','inventory-user@example.test','',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id,username) VALUES
 ('17000000-0000-4000-8000-000000000001','inventory_admin'),
 ('17000000-0000-4000-8000-000000000002','inventory_user');
INSERT INTO public.roles(id,code,name) VALUES
 ('27000000-0000-4000-8000-000000000001','admin','Administrator') ON CONFLICT (code) DO NOTHING;
INSERT INTO public.user_roles(user_id,role_id)
SELECT '17000000-0000-4000-8000-000000000001',id FROM public.roles WHERE code='admin';

SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_categories(id,name,slug,is_active) VALUES
 ('37000000-0000-4000-8000-000000000001','Inventory Category','inventory-category',true);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency) VALUES
 ('47000000-0000-4000-8000-000000000001','37000000-0000-4000-8000-000000000001','Draft Inventory','inventory-draft','physical',10,'USD'),
 ('47000000-0000-4000-8000-000000000002','37000000-0000-4000-8000-000000000001','Archived Inventory','inventory-archived','physical',10,'USD'),
 ('47000000-0000-4000-8000-000000000003','37000000-0000-4000-8000-000000000001','Published Zero','inventory-published-zero','physical',10,'USD');
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g,is_active) VALUES
 ('57000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','INV-DRAFT','Draft',10,'USD',100,true),
 ('57000000-0000-4000-8000-000000000002','47000000-0000-4000-8000-000000000002','INV-ARCHIVE','Archived',10,'USD',100,true),
 ('57000000-0000-4000-8000-000000000003','47000000-0000-4000-8000-000000000003','INV-ZERO','Published Zero',10,'USD',100,true),
 ('57000000-0000-4000-8000-000000000004','47000000-0000-4000-8000-000000000001','INV-INIT','Initialize',10,'USD',100,true),
 ('57000000-0000-4000-8000-000000000005','47000000-0000-4000-8000-000000000002','INV-ARCHIVE-INIT','Archived Initialize',10,'USD',100,true),
 ('57000000-0000-4000-8000-000000000006','47000000-0000-4000-8000-000000000001','INV-ZERO-INIT','Zero Initialize',10,'USD',100,true);
INSERT INTO public.evo_store_product_images(id,product_id,storage_path,is_primary,is_active) VALUES
 ('67000000-0000-4000-8000-000000000003','47000000-0000-4000-8000-000000000003','zero/image.jpg',true,true);
INSERT INTO public.evo_store_variant_prices(id,variant_id,currency,amount,is_active) VALUES
 ('77000000-0000-4000-8000-000000000003','57000000-0000-4000-8000-000000000003','USD',10,true);
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand,quantity_reserved) VALUES
 ('57000000-0000-4000-8000-000000000001',10,3),
 ('57000000-0000-4000-8000-000000000002',10,0),
 ('57000000-0000-4000-8000-000000000003',0,0);
UPDATE public.evo_store_products SET publication_status='archived'
WHERE id='47000000-0000-4000-8000-000000000002';
UPDATE public.evo_store_products SET publication_status='published'
WHERE id='47000000-0000-4000-8000-000000000003';
SET CONSTRAINTS ALL IMMEDIATE;

SELECT has_function('private','guard_evo_store_archived_product_inventory',ARRAY[]::text[],
 'private inventory archive guard exists');
SELECT trigger_is('public','evo_store_inventory','evo_store_inventory_guard_archived',
 'private','guard_evo_store_archived_product_inventory','inventory archive trigger exists');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='private.guard_evo_store_archived_product_inventory()'::regprocedure),
 'guard is security definer');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid='private.guard_evo_store_archived_product_inventory()'::regprocedure),
 ARRAY['search_path=""'],'guard has empty search path');
SELECT ok((SELECT (tgtype & 4)=4 AND (tgtype & 16)=16 AND (tgtype & 8)=8 FROM pg_trigger
 WHERE tgrelid='public.evo_store_inventory'::regclass AND tgname='evo_store_inventory_guard_archived'),
 'guard covers INSERT, UPDATE, and DELETE');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_proc function
 CROSS JOIN LATERAL aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
 WHERE function.oid='private.guard_evo_store_archived_product_inventory()'::regprocedure
 AND privilege.grantee=0 AND privilege.privilege_type='EXECUTE'),'PUBLIC cannot execute guard');
SELECT ok(NOT has_function_privilege('anon','private.guard_evo_store_archived_product_inventory()','EXECUTE'),
 'anon cannot execute guard');
SELECT ok(NOT has_function_privilege('authenticated','private.guard_evo_store_archived_product_inventory()','EXECUTE'),
 'authenticated cannot execute guard');

SELECT throws_ok($$INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand)
 VALUES ('57000000-0000-4000-8000-000000000005',1)$$,'P0001','EVO_STORE_INVENTORY_ARCHIVED_PRODUCT',
 'privileged INSERT under archived owner is rejected');
SELECT throws_ok($$UPDATE public.evo_store_inventory SET quantity_on_hand=11
 WHERE variant_id='57000000-0000-4000-8000-000000000002'$$,'P0001','EVO_STORE_INVENTORY_ARCHIVED_PRODUCT',
 'privileged UPDATE under archived owner is rejected');
SELECT throws_ok($$DELETE FROM public.evo_store_inventory
 WHERE variant_id='57000000-0000-4000-8000-000000000002'$$,'P0001','EVO_STORE_INVENTORY_ARCHIVED_PRODUCT',
 'privileged DELETE under archived owner is rejected');
SELECT lives_ok($$UPDATE public.evo_store_inventory SET quantity_on_hand=10
 WHERE variant_id='57000000-0000-4000-8000-000000000001'$$,'draft inventory remains mutable');

SELECT has_function('public','adjust_evo_store_inventory',ARRAY['uuid','text','integer','text'],
 'hardened inventory RPC retains its signature');
SELECT is(pg_get_function_result('public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure),
 'TABLE(variant_id uuid, quantity_on_hand integer, quantity_reserved integer, available_quantity integer, low_stock_threshold integer)',
 'inventory RPC retains its return columns');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure),
 'inventory RPC remains security definer');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid='public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure),
 ARRAY['search_path=""'],'inventory RPC keeps an empty search path');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_proc function
 CROSS JOIN LATERAL aclexplode(coalesce(function.proacl,acldefault('f',function.proowner))) privilege
 WHERE function.oid='public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure
 AND privilege.grantee=0 AND privilege.privilege_type='EXECUTE'),'PUBLIC cannot execute inventory RPC');
SELECT ok(NOT has_function_privilege('anon','public.adjust_evo_store_inventory(uuid,text,integer,text)','EXECUTE'),
 'anon cannot execute inventory RPC');
SELECT ok(has_function_privilege('authenticated','public.adjust_evo_store_inventory(uuid,text,integer,text)','EXECUTE'),
 'authenticated can execute inventory RPC');
SELECT ok(NOT has_table_privilege('authenticated','public.evo_store_inventory','INSERT,UPDATE,DELETE'),
 'authenticated has no direct inventory writes');
SELECT ok(NOT has_table_privilege('authenticated','public.evo_store_inventory_movements','INSERT,UPDATE,DELETE'),
 'authenticated has no direct movement writes');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000001','adjust',1,'stock_received')$$,
 '42501','staff access required','non-staff RPC execution is denied');
SELECT set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000001',true);

SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000005','initialize',1,'initial_stock')$$,
 'P0001','EVO_STORE_INVENTORY_ARCHIVED_PRODUCT','archived initialize is rejected');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000002','adjust',1,'stock_received')$$,
 'P0001','EVO_STORE_INVENTORY_ARCHIVED_PRODUCT','archived adjust is rejected');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000002','set',8,'stock_count')$$,
 'P0001','EVO_STORE_INVENTORY_ARCHIVED_PRODUCT','archived set is rejected');
SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000004','initialize',5,'initial_stock')$$,
 'nonzero initialization works');
SELECT is((SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='57000000-0000-4000-8000-000000000004'),5,
 'initialization stores quantity');
SELECT is((SELECT count(*)::integer FROM public.evo_store_inventory_movements WHERE variant_id='57000000-0000-4000-8000-000000000004'),1,
 'nonzero initialization writes one movement');
SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000006','initialize',0,'initial_stock')$$,
 'zero initialization works');
SELECT is((SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='57000000-0000-4000-8000-000000000006'),0,
 'zero initialization creates the inventory row');
SELECT is((SELECT count(*)::integer FROM public.evo_store_inventory_movements WHERE variant_id='57000000-0000-4000-8000-000000000006'),0,
 'zero initialization creates no movement');
SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000001','adjust',5,'stock_received')$$,
 'delta adjustment works');
SELECT is((SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='57000000-0000-4000-8000-000000000001'),15,
 'delta adjustment uses SQL-side arithmetic');
SELECT lives_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000001','set',9,'stock_count')$$,
 'absolute stocktake works');
SELECT is((SELECT quantity_on_hand FROM public.evo_store_inventory WHERE variant_id='57000000-0000-4000-8000-000000000001'),9,
 'set stores the target quantity');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000001','adjust',-10,'loss')$$,
 '22023','resulting stock cannot be negative','negative stock is rejected');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('57000000-0000-4000-8000-000000000001','set',2,'stock_count')$$,
 '22023','resulting stock cannot be below reserved stock','below-reserved stock is rejected');
SELECT is((SELECT count(*)::integer FROM public.evo_store_inventory_movements WHERE variant_id='57000000-0000-4000-8000-000000000001'),2,
 'failed mutations write no movement');
SELECT throws_ok($$SELECT * FROM public.adjust_evo_store_inventory('ffffffff-ffff-4fff-8fff-ffffffffffff','initialize',1,'initial_stock')$$,
 '23503','inventory variant does not exist','missing variant contract is preserved');
RESET ROLE;

SELECT is((SELECT count(*)::integer FROM public.inspect_evo_store_product_readiness('47000000-0000-4000-8000-000000000003')
 WHERE code='EVO_STORE_READY_VARIANT_INVENTORY_REQUIRED'),0,'zero-stock inventory row satisfies readiness');
SELECT is((SELECT availability FROM public.get_evo_store_variant_availability(ARRAY['57000000-0000-4000-8000-000000000003'::uuid])),
 'out_of_stock','zero stock remains a valid published out-of-stock state');
SELECT is(pg_get_function_result('public.get_evo_store_variant_availability(uuid[])'::regprocedure),
 'TABLE(variant_id uuid, availability text)','public availability remains quantity-free');
SELECT trigger_is('public','evo_store_inventory','evo_store_inventory_readiness',
 'private','enforce_evo_store_product_readiness','inventory readiness trigger remains');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.evo_store_inventory'::regclass
 AND tgname='evo_store_inventory_updated_at'),'updated_at trigger remains');

SELECT * FROM finish();
ROLLBACK;
