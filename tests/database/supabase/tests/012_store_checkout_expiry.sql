BEGIN;
SET LOCAL search_path = public, extensions;
SELECT no_plan();
\ir fixtures_store_expiry.sql
CREATE FUNCTION pg_temp.hold(n integer, lines jsonb DEFAULT '[{"variant_id":"58000000-0000-4000-8000-000000000001","quantity":2}]') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','18000000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
 result := public.create_evo_store_checkout(lines,'USD',gen_random_uuid(),('98000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid);
 RETURN (result->>'id')::uuid;
END $$;
CREATE TEMP TABLE results(name text PRIMARY KEY, value jsonb);
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.expire_evo_store_checkouts(integer)'::regprocedure),'worker security definer');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid='public.expire_evo_store_checkouts(integer)'::regprocedure),ARRAY['search_path=""'],'empty search path');
SELECT ok(has_function_privilege('service_role','public.expire_evo_store_checkouts(integer)','EXECUTE'),'service role allowed');
SELECT ok(NOT has_function_privilege('anon','public.expire_evo_store_checkouts(integer)','EXECUTE'),'anon denied');
SELECT ok(NOT has_function_privilege('authenticated','public.expire_evo_store_checkouts(integer)','EXECUTE'),'authenticated and staff denied');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_proc f CROSS JOIN LATERAL aclexplode(f.proacl) a WHERE f.oid='public.expire_evo_store_checkouts(integer)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE'),'PUBLIC denied');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='private.evo_store_checkout_expiry_failures'::regclass),'private failures RLS');
SELECT ok(NOT has_table_privilege('service_role','private.evo_store_checkout_expiry_failures','SELECT'),'private failure details not exposed to service API');
SELECT ok(NOT has_table_privilege('authenticated','private.evo_store_checkout_expiry_failures','SELECT'),'failure records denied to customers');
SELECT ok(NOT has_function_privilege('service_role','private.finish_evo_store_checkout_hold(uuid,public.evo_store_checkout_status)','EXECUTE'),'terminal helper still private');
SET LOCAL ROLE anon;
SELECT throws_ok('SELECT public.expire_evo_store_checkouts(25)','42501',NULL,'anon execution rejected');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok('SELECT public.expire_evo_store_checkouts(25)','42501',NULL,'customer execution rejected');
RESET ROLE;
SELECT throws_ok('SELECT public.expire_evo_store_checkouts(NULL)','22023','EVO_STORE_CHECKOUT_EXPIRY_BATCH_INVALID','null batch rejected');
SELECT throws_ok('SELECT public.expire_evo_store_checkouts(0)','22023','EVO_STORE_CHECKOUT_EXPIRY_BATCH_INVALID','zero batch rejected');
SELECT throws_ok('SELECT public.expire_evo_store_checkouts(26)','22023','EVO_STORE_CHECKOUT_EXPIRY_BATCH_INVALID','oversized batch rejected');
SELECT throws_ok('SELECT public.expire_evo_store_checkouts(-1)','22023','EVO_STORE_CHECKOUT_EXPIRY_BATCH_INVALID','negative batch rejected');
SELECT pg_temp.hold(1); SELECT pg_temp.hold(2);
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now() WHERE user_id='18000000-0000-4000-8000-000000000001';
CREATE TEMP TABLE stock_before AS SELECT variant_id,quantity_on_hand FROM public.evo_store_inventory;
CREATE TEMP TABLE movements_before AS SELECT * FROM public.evo_store_inventory_movements;
INSERT INTO results VALUES('boundary',public.expire_evo_store_checkouts());
SELECT is((SELECT (value->>'expired')::integer FROM results WHERE name='boundary'),1,'exact boundary expires');
SELECT is((SELECT status::text FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000001'),'expired','expired terminal state');
SELECT is((SELECT expired_at FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000001'),transaction_timestamp(),'database timestamp');
SELECT is((SELECT status::text FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000002'),'active','nonexpired preserved');
SELECT is((SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='58000000-0000-4000-8000-000000000001'),2,'exactly one hold released');
SELECT is((public.expire_evo_store_checkouts()->>'expired')::integer,0,'repeat no double release');
SELECT is((SELECT count(*) FROM jsonb_object_keys((SELECT value FROM results WHERE name='boundary'))),7::bigint,'only seven aggregate fields');

-- A corrupt oldest multi-line hold cannot roll back a healthy later hold.
SELECT pg_temp.hold(3,'[{"variant_id":"58000000-0000-4000-8000-000000000002","quantity":2},{"variant_id":"58000000-0000-4000-8000-000000000003","quantity":2}]');
SELECT pg_temp.hold(4,'[{"variant_id":"58000000-0000-4000-8000-000000000004","quantity":2}]');
UPDATE public.evo_store_checkouts SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE user_id='18000000-0000-4000-8000-000000000003';
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE user_id='18000000-0000-4000-8000-000000000004';
UPDATE public.evo_store_inventory SET quantity_reserved=1 WHERE variant_id='58000000-0000-4000-8000-000000000003';
INSERT INTO results VALUES('corrupt',public.expire_evo_store_checkouts());
SELECT is((SELECT (value->>'expired')::integer FROM results WHERE name='corrupt'),1,'healthy checkout progresses');
SELECT is((SELECT (value->>'reconciliation_failed')::integer FROM results WHERE name='corrupt'),1,'reconciliation distinct from success');
SELECT is((SELECT status::text FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000003'),'active','corrupt hold remains active');
SELECT is((SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='58000000-0000-4000-8000-000000000002'),2,'healthy line of failed checkout retained');
SELECT is((SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='58000000-0000-4000-8000-000000000003'),1,'corrupt quantity never clamped');
SELECT is((SELECT attempts FROM private.evo_store_checkout_expiry_failures),1,'failure recorded after savepoint rollback');
SELECT is((public.expire_evo_store_checkouts()->>'examined')::integer,0,'backoff defers corrupt oldest');
UPDATE private.evo_store_checkout_expiry_failures SET last_failed_at=now()-interval '2 minutes',retry_after=now()-interval '1 minute';
SELECT pg_temp.hold(4,'[{"variant_id":"58000000-0000-4000-8000-000000000004","quantity":2}]');
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE user_id='18000000-0000-4000-8000-000000000004' AND status='active';
SELECT is((public.expire_evo_store_checkouts(1)->>'expired')::integer,1,'healthy progress even with due older corrupt row and batch one');
SELECT is((public.expire_evo_store_checkouts()->>'reconciliation_failed')::integer,1,'failed retry retains hold');
SELECT is((SELECT attempts FROM private.evo_store_checkout_expiry_failures),2,'attempt count advances');
UPDATE public.evo_store_inventory SET quantity_reserved=2 WHERE variant_id='58000000-0000-4000-8000-000000000003';
UPDATE private.evo_store_checkout_expiry_failures SET last_failed_at=now()-interval '2 minutes',retry_after=now()-interval '1 minute';
SELECT is((public.expire_evo_store_checkouts()->>'expired')::integer,1,'reconciled checkout retries safely');
SELECT is((SELECT count(*) FROM private.evo_store_checkout_expiry_failures),0::bigint,'successful retry removes failure');

-- Archived parents permit only reserved decreases, not physical stock mutation.
SELECT pg_temp.hold(5,'[{"variant_id":"58000000-0000-4000-8000-000000000005","quantity":3}]');
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE user_id='18000000-0000-4000-8000-000000000005';
UPDATE public.evo_store_products SET publication_status='archived' WHERE id='48000000-0000-4000-8000-000000000005';
SELECT is((public.expire_evo_store_checkouts()->>'expired')::integer,1,'archived hold expires');
SELECT is((SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='58000000-0000-4000-8000-000000000005'),0,'archived reservation fully released');
SELECT throws_ok($$UPDATE public.evo_store_inventory SET quantity_on_hand=999 WHERE variant_id='58000000-0000-4000-8000-000000000005'$$,'P0001','EVO_STORE_INVENTORY_ARCHIVED_PRODUCT','archived physical stock guard unchanged');
SELECT throws_ok($$UPDATE public.evo_store_inventory SET quantity_reserved=1 WHERE variant_id='58000000-0000-4000-8000-000000000005'$$,'P0001','EVO_STORE_INVENTORY_ARCHIVED_PRODUCT','archived increment guard unchanged');

-- Prove per-transition rollback even when an exception occurs AFTER inventory UPDATE.
SELECT pg_temp.hold(6,'[{"variant_id":"58000000-0000-4000-8000-000000000006","quantity":2}]');
SELECT pg_temp.hold(7,'[{"variant_id":"58000000-0000-4000-8000-000000000007","quantity":2}]');
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE user_id IN ('18000000-0000-4000-8000-000000000006','18000000-0000-4000-8000-000000000007');
CREATE FUNCTION pg_temp.fail_terminal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.user_id='18000000-0000-4000-8000-000000000006' AND NEW.status='expired' THEN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='EVO_STORE_CHECKOUT_RECONCILIATION_REQUIRED'; END IF; RETURN NEW; END $$;
CREATE TRIGGER synthetic_reconciliation BEFORE UPDATE ON public.evo_store_checkouts FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_terminal();
INSERT INTO results VALUES('savepoint',public.expire_evo_store_checkouts());
SELECT is((SELECT (value->>'expired')::integer FROM results WHERE name='savepoint'),1,'other transition succeeds after subtransaction failure');
SELECT is((SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='58000000-0000-4000-8000-000000000006'),2,'prior decrement rolled back by subtransaction');
SELECT is((SELECT status::text FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000006'),'active','header rolled back too');
DROP TRIGGER synthetic_reconciliation ON public.evo_store_checkouts;
SAVEPOINT whole_batch;
UPDATE private.evo_store_checkout_expiry_failures SET last_failed_at=now()-interval '2 minutes',retry_after=now()-interval '1 minute';
SELECT is((public.expire_evo_store_checkouts()->>'expired')::integer,1,'repaired hold expires before caller rollback');
ROLLBACK TO whole_batch;
SELECT is((SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='58000000-0000-4000-8000-000000000006'),2,'caller rollback restores release');
SELECT is((SELECT count(*) FROM private.evo_store_checkout_expiry_failures),1::bigint,'caller rollback restores prior retry record');

-- Missing item rows are reconciliations, never successful empty releases.
SELECT pg_temp.hold(8,'[{"variant_id":"58000000-0000-4000-8000-000000000008","quantity":1}]');
DELETE FROM public.evo_store_checkout_items WHERE checkout_id IN (SELECT id FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000008');
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE user_id='18000000-0000-4000-8000-000000000008';
SAVEPOINT failed_log;
SELECT is((public.expire_evo_store_checkouts()->>'reconciliation_failed')::integer,1,'no-item reservation rejected');
ROLLBACK TO failed_log;
SELECT is((SELECT count(*) FROM private.evo_store_checkout_expiry_failures WHERE checkout_id IN (SELECT id FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000008')),0::bigint,'failure log does not survive caller rollback');
SELECT is((public.expire_evo_store_checkouts()->>'reconciliation_failed')::integer,1,'aborted attempt safely retries');

-- A missing inventory row is detected; test-only deletion rolls back before readiness checks.
SELECT pg_temp.hold(9,'[{"variant_id":"58000000-0000-4000-8000-000000000009","quantity":2}]');
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE user_id='18000000-0000-4000-8000-000000000009';
SAVEPOINT missing_inventory;
SET CONSTRAINTS ALL DEFERRED;
DELETE FROM public.evo_store_inventory WHERE variant_id='58000000-0000-4000-8000-000000000009';
SELECT is((public.expire_evo_store_checkouts()->>'reconciliation_failed')::integer,1,'missing inventory reconciles instead of expiring');
ROLLBACK TO missing_inventory;
SELECT is((public.expire_evo_store_checkouts()->>'expired')::integer,1,'restored missing inventory retries');

-- Unexpected errors must abort ALL batch effects, with no durable failure claim.
SELECT pg_temp.hold(120,'[{"variant_id":"58000000-0000-4000-8000-000000000009","quantity":2}]');
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE user_id='18000000-0000-4000-8000-000000000120';
CREATE FUNCTION pg_temp.fail_unexpected() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.user_id='18000000-0000-4000-8000-000000000120' AND NEW.status='expired' THEN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SYNTHETIC_UNEXPECTED_EXPIRY_ERROR'; END IF; RETURN NEW; END $$;
CREATE TRIGGER synthetic_unexpected BEFORE UPDATE ON public.evo_store_checkouts FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_unexpected();
SELECT throws_ok('SELECT public.expire_evo_store_checkouts()','P0001','SYNTHETIC_UNEXPECTED_EXPIRY_ERROR','unexpected failure propagates');
SELECT is((SELECT quantity_reserved FROM public.evo_store_inventory WHERE variant_id='58000000-0000-4000-8000-000000000009'),2,'unexpected failure rolls back decrement');
SELECT is((SELECT status::text FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000120'),'active','unexpected failure leaves header active');
SELECT is((SELECT count(*) FROM private.evo_store_checkout_expiry_failures WHERE checkout_id IN (SELECT id FROM public.evo_store_checkouts WHERE user_id='18000000-0000-4000-8000-000000000120')),0::bigint,'unexpected error not swallowed or logged as reconciliation');
DROP TRIGGER synthetic_unexpected ON public.evo_store_checkouts;
SELECT is((public.expire_evo_store_checkouts()->>'expired')::integer,1,'unexpected aborted batch safely retries');

-- Over 100 independent expired users; batch cap leaves inventory reconcilable.
SELECT pg_temp.hold(n,'[{"variant_id":"58000000-0000-4000-8000-000000000001","quantity":1}]') FROM generate_series(10,119) n;
UPDATE public.evo_store_checkouts SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second' WHERE user_id BETWEEN '18000000-0000-4000-8000-000000000010' AND '18000000-0000-4000-8000-000000000119';
SELECT is((public.expire_evo_store_checkouts(1)->>'expired')::integer,1,'one-item batch honored');
INSERT INTO results VALUES('batch',public.expire_evo_store_checkouts(25));
SELECT is((SELECT (value->>'claimed')::integer FROM results WHERE name='batch'),25,'max batch honored');
SELECT is((SELECT (value->>'examined')::integer FROM results WHERE name='batch'),25,'stop discovering after batch fills');
SELECT ok((SELECT (value->>'batch_limit_reached')::boolean FROM results WHERE name='batch'),'batch continuation signal');
SELECT results_eq('SELECT variant_id,quantity_on_hand FROM public.evo_store_inventory ORDER BY variant_id','SELECT variant_id,quantity_on_hand FROM stock_before ORDER BY variant_id','on-hand invariant for all inventory');
SELECT results_eq('SELECT * FROM public.evo_store_inventory_movements ORDER BY id','SELECT * FROM movements_before ORDER BY id','movement ledger completely unchanged');
SET CONSTRAINTS ALL IMMEDIATE;
SELECT * FROM finish();
ROLLBACK;
