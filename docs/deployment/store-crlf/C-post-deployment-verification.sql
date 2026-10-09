-- READ ONLY. No checkout, inventory adjustment or expiry RPC invocation.
BEGIN TRANSACTION READ ONLY;
SELECT n.nspname,c.relname,pg_catalog.pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,
 c.relforcerowsecurity,c.relacl FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='public' AND c.relname IN ('evo_store_checkouts','evo_store_checkout_items'))
 OR (n.nspname='private' AND c.relname='evo_store_checkout_expiry_failures');
SELECT signature,pg_catalog.to_regprocedure(signature) AS function_oid FROM (VALUES
 ('public.adjust_evo_store_inventory(uuid,text,integer,text)'),
 ('public.create_evo_store_checkout(jsonb,text,uuid,uuid)'),
 ('public.release_evo_store_checkout(uuid)'),('public.expire_evo_store_checkouts(integer)')) required(signature);
SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_catalog.pg_get_function_result(p.oid) AS result,
 pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef,
 ARRAY(SELECT cfg FROM pg_catalog.unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') AS search_path,
 p.proacl,pg_catalog.md5(p.prosrc) AS body_md5
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND (p.proname LIKE '%evo_store_checkout%'
 OR p.proname IN ('adjust_evo_store_inventory','guard_evo_store_archived_product_inventory','evo_store_currency_supported'))
ORDER BY n.nspname,p.proname,arguments;
-- All public RPCs and guard: postgres owner, SECURITY DEFINER, search_path="".
-- Internal invoker helpers intentionally differ; compare with source.
-- Only CRLF pairs normalize; lone CR and all other differences must fail.
SELECT pg_catalog.md5(prosrc) AS raw_body_md5,
 pg_catalog.octet_length(prosrc) AS body_bytes,
 pg_catalog.length(prosrc)-pg_catalog.length(pg_catalog.replace(prosrc,pg_catalog.chr(13),'')) AS carriage_return_count,
 pg_catalog.md5(pg_catalog.replace(prosrc,pg_catalog.chr(13)||pg_catalog.chr(10),pg_catalog.chr(10))) AS canonical_body_md5,
 pg_catalog.md5(pg_catalog.replace(prosrc,pg_catalog.chr(13)||pg_catalog.chr(10),pg_catalog.chr(10)))='b1ac65d9a274ab4c40a6451e78d790cb' AS exact_phase_2jb_guard_body
FROM pg_catalog.pg_proc WHERE oid='private.guard_evo_store_archived_product_inventory()'::regprocedure;
SELECT t.tgname,t.tgrelid::regclass AS table_name,t.tgfoid::regprocedure AS function_name,
 t.tgtype,t.tgenabled,t.tgqual IS NULL AS no_when,t.tgnargs,
 t.tgattr::text AS column_filter,t.tgisinternal,t.tgconstraint,
 t.tgoldtable,t.tgnewtable,pg_catalog.pg_get_triggerdef(t.oid,true) AS definition
FROM pg_catalog.pg_trigger t WHERE t.tgname='evo_store_inventory_guard_archived';
-- EXPECT exactly one inventory trigger: tgtype=31, enabled=O, no filters/args.
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_catalog.pg_policies
WHERE (schemaname='public' AND tablename IN ('evo_store_checkouts','evo_store_checkout_items'))
 OR (schemaname='private' AND tablename='evo_store_checkout_expiry_failures');
SELECT r.rolname,n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute,
 EXISTS (SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
 WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_can_execute
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE r.rolname IN ('anon','authenticated','service_role') AND n.nspname IN ('public','private')
 AND (p.proname LIKE '%evo_store_checkout%' OR p.proname IN ('adjust_evo_store_inventory','guard_evo_store_archived_product_inventory'))
ORDER BY n.nspname,p.proname,arguments,r.rolname;
SELECT r.rolname,n.nspname,c.relname,
 pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
 pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS any_write
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('anon','authenticated','service_role') AND c.relkind IN ('r','p')
 AND ((n.nspname='public' AND c.relname IN ('evo_store_inventory','evo_store_inventory_movements','evo_store_checkouts','evo_store_checkout_items'))
 OR (n.nspname='private' AND c.relname='evo_store_checkout_expiry_failures')) ORDER BY n.nspname,c.relname,r.rolname;
SELECT k.conrelid::regclass AS table_name,k.conname,k.convalidated,pg_catalog.pg_get_constraintdef(k.oid,true) AS definition
FROM pg_catalog.pg_constraint k WHERE k.conrelid IN ('public.evo_store_checkouts'::regclass,'public.evo_store_checkout_items'::regclass,'private.evo_store_checkout_expiry_failures'::regclass) ORDER BY table_name,k.conname;
SELECT schemaname,tablename,indexname,indexdef FROM pg_catalog.pg_indexes
WHERE (schemaname='public' AND tablename IN ('evo_store_checkouts','evo_store_checkout_items'))
 OR (schemaname='private' AND tablename='evo_store_checkout_expiry_failures');
-- Compare exactly with pre-execution results; expected all zero in this window.
SELECT (SELECT count(*) FROM public.evo_store_products) AS products,
 (SELECT count(*) FROM public.evo_store_variants) AS variants,
 (SELECT count(*) FROM public.evo_store_variant_prices) AS prices,
 (SELECT count(*) FROM public.evo_store_inventory) AS inventory,
 (SELECT count(*) FROM public.evo_store_inventory_movements) AS movements;
SELECT count(*) AS inventory_rows,coalesce(sum(quantity_on_hand::bigint),0) AS on_hand,
 coalesce(sum(quantity_reserved::bigint),0) AS reserved,
 count(*) FILTER (WHERE quantity_on_hand<0 OR quantity_reserved<0 OR quantity_reserved>quantity_on_hand
 OR quantity_on_hand IS NULL OR quantity_reserved IS NULL) AS invalid_rows FROM public.evo_store_inventory;
SELECT count(*) AS movement_rows,coalesce(sum(quantity_change::bigint),0) AS net_movement FROM public.evo_store_inventory_movements;
SELECT (SELECT count(*) FROM public.evo_store_checkouts) AS checkouts,
 (SELECT count(*) FROM public.evo_store_checkout_items) AS items,
 (SELECT count(*) FROM private.evo_store_checkout_expiry_failures) AS failures;
SELECT count(*) AS expired_active FROM public.evo_store_checkouts
 WHERE status='active' AND expires_at<=pg_catalog.transaction_timestamp();
COMMIT;
