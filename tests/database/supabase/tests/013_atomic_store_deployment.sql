-- Executed only through the canonical disposable runner AFTER atomic COMMIT.
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT no_plan();
SELECT has_function('public','adjust_evo_store_inventory',ARRAY['uuid','text','integer','text'],'inventory adjustment RPC installed');
SELECT has_function('public','create_evo_store_checkout',ARRAY['jsonb','text','uuid','uuid'],'creation RPC installed');
SELECT has_function('public','release_evo_store_checkout',ARRAY['uuid'],'release RPC installed');
SELECT has_function('public','expire_evo_store_checkouts',ARRAY['integer'],'expiry RPC installed');
SELECT is(pg_get_function_result('public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure),
 'TABLE(variant_id uuid, quantity_on_hand integer, quantity_reserved integer, available_quantity integer, low_stock_threshold integer)','adjustment result signature');
SELECT ok(prosecdef, proname || ' SECURITY DEFINER') FROM pg_proc
 WHERE oid IN ('public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure,
 'public.create_evo_store_checkout(jsonb,text,uuid,uuid)'::regprocedure,
 'public.release_evo_store_checkout(uuid)'::regprocedure,
 'public.expire_evo_store_checkouts(integer)'::regprocedure,
 'private.guard_evo_store_archived_product_inventory()'::regprocedure);
SELECT is(proconfig, ARRAY['search_path=""'], proname || ' empty search_path') FROM pg_proc
 WHERE oid IN ('public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure,
 'public.create_evo_store_checkout(jsonb,text,uuid,uuid)'::regprocedure,
 'public.release_evo_store_checkout(uuid)'::regprocedure,
 'public.expire_evo_store_checkouts(integer)'::regprocedure,
 'private.guard_evo_store_archived_product_inventory()'::regprocedure);
SELECT is(pg_get_userbyid(proowner), 'postgres', proname || ' trusted owner') FROM pg_proc
 WHERE oid IN ('public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure,
 'public.create_evo_store_checkout(jsonb,text,uuid,uuid)'::regprocedure,
 'public.release_evo_store_checkout(uuid)'::regprocedure,
 'public.expire_evo_store_checkouts(integer)'::regprocedure,
 'private.guard_evo_store_archived_product_inventory()'::regprocedure);
SELECT is(md5(prosrc),'b1ac65d9a274ab4c40a6451e78d790cb','final guard is exact B decrement-compatible body') FROM pg_proc
 WHERE oid='private.guard_evo_store_archived_product_inventory()'::regprocedure;
SELECT trigger_is('public','evo_store_inventory','evo_store_inventory_guard_archived','private','guard_evo_store_archived_product_inventory','canonical trigger wiring');
SELECT ok(tgtype=31 AND tgenabled='O' AND tgqual IS NULL AND tgnargs=0
 AND tgattr=''::int2vector AND NOT tgisinternal AND tgconstraint=0
 AND tgoldtable IS NULL AND tgnewtable IS NULL,'exact enabled BEFORE ROW INSERT UPDATE DELETE trigger')
 FROM pg_trigger WHERE tgrelid='public.evo_store_inventory'::regclass AND tgname='evo_store_inventory_guard_archived';
SELECT is((SELECT count(*)::integer FROM pg_trigger WHERE tgrelid='public.evo_store_inventory'::regclass AND tgname='evo_store_inventory_guard_archived'),1,'no duplicate guard');
SELECT ok(relrowsecurity, relname || ' RLS enabled') FROM pg_class
 WHERE oid IN ('public.evo_store_checkouts'::regclass,'public.evo_store_checkout_items'::regclass,'private.evo_store_checkout_expiry_failures'::regclass);
SELECT is((SELECT count(*)::integer FROM pg_policy WHERE polrelid IN ('public.evo_store_checkouts'::regclass,'public.evo_store_checkout_items'::regclass)),4,'owner and staff SELECT policies installed');
SELECT ok(has_function_privilege('authenticated','public.adjust_evo_store_inventory(uuid,text,integer,text)','EXECUTE'),'authenticated adjustment entrypoint retains staff gate');
SELECT ok(has_function_privilege('authenticated','public.create_evo_store_checkout(jsonb,text,uuid,uuid)','EXECUTE'),'authenticated create');
SELECT ok(has_function_privilege('authenticated','public.release_evo_store_checkout(uuid)','EXECUTE'),'authenticated release');
SELECT ok(has_function_privilege('service_role','public.expire_evo_store_checkouts(integer)','EXECUTE'),'service expiry');
SELECT ok(NOT has_function_privilege(r.rolname,'public.expire_evo_store_checkouts(integer)','EXECUTE'),r.rolname || ' denied expiry')
 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.oid IN ('public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure,
 'public.create_evo_store_checkout(jsonb,text,uuid,uuid)'::regprocedure,'public.release_evo_store_checkout(uuid)'::regprocedure,
 'public.expire_evo_store_checkouts(integer)'::regprocedure,'private.guard_evo_store_archived_product_inventory()'::regprocedure)
 AND a.grantee=0 AND a.privilege_type='EXECUTE'),'PUBLIC denied privileged entrypoints');
SELECT ok(NOT has_table_privilege(r.rolname,t.name,'INSERT,UPDATE,DELETE,TRUNCATE'),r.rolname || ' cannot mutate ' || t.name)
 FROM pg_roles r CROSS JOIN (VALUES ('public.evo_store_inventory'),('public.evo_store_inventory_movements'),('public.evo_store_checkouts'),('public.evo_store_checkout_items')) t(name)
 WHERE r.rolname IN ('anon','authenticated');
SELECT ok(NOT has_table_privilege(r.rolname,'private.evo_store_checkout_expiry_failures','SELECT,INSERT,UPDATE,DELETE'),r.rolname || ' no direct failure-table access')
 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role');
SELECT ok(NOT has_function_privilege(r.rolname,'private.guard_evo_store_archived_product_inventory()','EXECUTE'),r.rolname || ' no guard execution')
 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated');
SELECT ok(NOT has_function_privilege('anon',p.oid,'EXECUTE'),p.proname || ' denies anon') FROM pg_proc p
 WHERE p.oid IN ('public.adjust_evo_store_inventory(uuid,text,integer,text)'::regprocedure,
 'public.create_evo_store_checkout(jsonb,text,uuid,uuid)'::regprocedure,'public.release_evo_store_checkout(uuid)'::regprocedure);
SELECT has_index('public','evo_store_checkouts','evo_store_checkouts_active_expiry_idx','active expiry index');
SELECT has_index('public','evo_store_checkouts','evo_store_checkouts_one_active_user_idx','active user uniqueness');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.evo_store_inventory WHERE quantity_reserved<0 OR quantity_on_hand<quantity_reserved),'inventory bounds preserved');
SELECT * FROM finish();
ROLLBACK;
