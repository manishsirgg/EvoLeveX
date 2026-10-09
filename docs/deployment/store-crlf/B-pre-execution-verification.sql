-- READ ONLY. Select project qizgkxgiannzmzsrchot in SQL Editor first.
-- Presence is not proof of correct helper behavior: review stored definitions.
BEGIN TRANSACTION READ ONLY;
SELECT current_database(), current_user, current_setting('server_version') AS server_version;

-- EXPECT present: schemas, trusted postgres owner, roles and critical helpers.
SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname IN ('public','private','auth') ORDER BY 1;
SELECT rolname, rolsuper, rolbypassrls FROM pg_catalog.pg_roles
 WHERE rolname IN ('postgres','anon','authenticated','service_role') ORDER BY 1;
SELECT signature, pg_catalog.to_regprocedure(signature) AS resolved
FROM (VALUES ('private.is_staff()'),('auth.uid()'),('public.set_updated_at()'),
 ('private.evo_store_product_readiness_error(uuid)')) required(signature);
SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_catalog.pg_get_function_result(p.oid) AS result,
 pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef,
 ARRAY(SELECT cfg FROM pg_catalog.unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') AS search_path,
 pg_catalog.md5(p.prosrc) AS body_md5,
 pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='private' AND p.proname IN ('is_staff','evo_store_product_readiness_error','enforce_evo_store_product_readiness','enforce_evo_store_category_readiness'))
 OR (n.nspname='public' AND p.proname='set_updated_at')
 OR (n.nspname='auth' AND p.proname='uid') ORDER BY n.nspname,p.proname;

-- EXPECT NULL: original inventory objects and every checkout object below.
SELECT signature, pg_catalog.to_regprocedure(signature) AS unexpected_existing_function
FROM (VALUES ('public.adjust_evo_store_inventory(uuid,text,integer,text)'),
 ('private.guard_evo_store_archived_product_inventory()'),
 ('public.create_evo_store_checkout(jsonb,text,uuid,uuid)'),
 ('public.release_evo_store_checkout(uuid)'),('public.expire_evo_store_checkouts(integer)'),
 ('private.evo_store_currency_supported(text)'),
 ('private.guard_evo_store_checkout_terminal_status()'),
 ('private.lock_evo_store_checkout_inventory(uuid[],uuid[])'),
 ('private.evo_store_checkout_result(uuid)')) required(signature);
SELECT pg_catalog.to_regclass('public.evo_store_checkouts') AS checkouts,
 pg_catalog.to_regclass('public.evo_store_checkout_items') AS checkout_items,
 pg_catalog.to_regclass('private.evo_store_checkout_expiry_failures') AS failures,
 pg_catalog.to_regtype('public.evo_store_checkout_status') AS checkout_status;
-- Enumerate overloads/partial objects too; expected no checkout-named functions/types.
SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND (p.proname LIKE '%evo_store_checkout%'
 OR p.proname IN ('adjust_evo_store_inventory','guard_evo_store_archived_product_inventory','evo_store_currency_supported'));
SELECT n.nspname,t.typname FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
 WHERE n.nspname IN ('public','private') AND t.typname LIKE '%evo_store_checkout%';

-- Canonical archive trigger must be absent everywhere for this exact sequence.
-- Readiness/update trigger definitions must match reviewed Store baseline.
SELECT t.tgrelid::regclass AS table_name,t.tgname,t.tgenabled,
 pg_catalog.pg_get_triggerdef(t.oid,true) AS definition
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND (t.tgname='evo_store_inventory_guard_archived'
 OR (n.nspname='public' AND c.relname LIKE 'evo_store_%')) ORDER BY table_name,t.tgname;

SELECT n.nspname,t.typname,e.enumlabel,e.enumsortorder
FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
WHERE n.nspname='public' AND t.typname IN ('product_mode','evo_store_publication_status')
ORDER BY t.typname,e.enumsortorder;
SELECT k.conrelid::regclass AS table_name,k.conname,k.convalidated,
 pg_catalog.pg_get_constraintdef(k.oid,true) AS definition
FROM pg_catalog.pg_constraint k WHERE k.conrelid IN
 ('public.evo_store_inventory'::regclass,'public.evo_store_inventory_movements'::regclass,
  'public.evo_store_variant_prices'::regclass) ORDER BY table_name,k.conname;

-- EXPECT five counts, both totals and movement count/net quantity all zero.
SELECT (SELECT count(*) FROM public.evo_store_products) AS products,
 (SELECT count(*) FROM public.evo_store_variants) AS variants,
 (SELECT count(*) FROM public.evo_store_variant_prices) AS prices,
 (SELECT count(*) FROM public.evo_store_inventory) AS inventory,
 (SELECT count(*) FROM public.evo_store_inventory_movements) AS movements;
SELECT count(*) AS inventory_rows,coalesce(sum(quantity_on_hand::bigint),0) AS on_hand,
 coalesce(sum(quantity_reserved::bigint),0) AS reserved,
 count(*) FILTER (WHERE quantity_on_hand<0 OR quantity_reserved<0
 OR quantity_reserved>quantity_on_hand OR quantity_on_hand IS NULL OR quantity_reserved IS NULL) AS invalid_rows
FROM public.evo_store_inventory;
SELECT count(*) AS movement_rows,coalesce(sum(quantity_change::bigint),0) AS net_movement
FROM public.evo_store_inventory_movements;
SELECT r.rolname,c.relname,c.relrowsecurity,
 pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS any_write
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public'
 AND c.relname IN ('evo_store_inventory','evo_store_inventory_movements') ORDER BY c.relname,r.rolname;
COMMIT;
