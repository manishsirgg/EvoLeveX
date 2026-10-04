BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(72);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
 email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('11000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','lifecycle@example.test','',now(),'{}','{}',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO public.profiles(id,username) VALUES ('11000000-0000-4000-8000-000000000001','lifecycle') ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_categories(id,name,slug) VALUES ('31000000-0000-4000-8000-000000000001','Lifecycle','lifecycle') ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_products(id,kind,name,slug,product_mode,price,currency,is_active,category_id)
VALUES
 ('41000000-0000-4000-8000-000000000001','book','Lifecycle Book','lifecycle-book','digital',100,'USD',true,'31000000-0000-4000-8000-000000000001'),
 ('41000000-0000-4000-8000-000000000002','book','Recovery Book','recovery-book','digital',100,'USD',true,'31000000-0000-4000-8000-000000000001'),
 ('41000000-0000-4000-8000-000000000003','book','Expired Recovery Book','expired-recovery-book','digital',100,'USD',true,'31000000-0000-4000-8000-000000000001'),
 ('41000000-0000-4000-8000-000000000004','book','Cancelled Book','cancelled-book','digital',100,'USD',true,'31000000-0000-4000-8000-000000000001');
INSERT INTO public.evo_vault_books(vault_product_id)
SELECT id FROM public.evo_vault_products WHERE id::text LIKE '41000000-0000-4000-8000-00000000000_';
INSERT INTO public.evo_vault_book_assets(vault_product_id,title,file_path,file_size,is_primary)
SELECT id,'PDF','vault/'||slug||'.pdf',100,true FROM public.evo_vault_products
WHERE id::text LIKE '41000000-0000-4000-8000-00000000000_';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$SELECT * FROM public.create_pending_evo_vault_order('41000000-0000-4000-8000-000000000001','USD')$$, 'checkout created');
SELECT lives_ok($$SELECT * FROM public.reserve_razorpay_payment((SELECT id FROM public.orders WHERE user_id='11000000-0000-4000-8000-000000000001'))$$, 'payment reserved');
SELECT lives_ok($$SELECT * FROM public.attach_razorpay_order((SELECT id FROM public.payments WHERE order_id=(SELECT id FROM public.orders WHERE user_id='11000000-0000-4000-8000-000000000001')),'order_SYNTHETIC1001')$$, 'synthetic provider order attached');
SELECT lives_ok($$SELECT * FROM public.confirm_razorpay_payment((SELECT id FROM public.payments WHERE provider_order_id='order_SYNTHETIC1001'),'order_SYNTHETIC1001','pay_SYNTHETIC1001')$$, 'payment confirms and fulfills');
SELECT is((SELECT status::text FROM public.orders WHERE user_id='11000000-0000-4000-8000-000000000001'),'confirmed','order confirmed');
SELECT is((SELECT status::text FROM public.payments WHERE provider_order_id='order_SYNTHETIC1001'),'paid','payment paid');
SELECT is((SELECT count(*) FROM public.digital_access WHERE user_id='11000000-0000-4000-8000-000000000001'),1::bigint,'exactly one entitlement exists');
SELECT lives_ok($$SELECT * FROM public.confirm_razorpay_payment((SELECT id FROM public.payments WHERE provider_order_id='order_SYNTHETIC1001'),'order_SYNTHETIC1001','pay_SYNTHETIC1001')$$,'duplicate confirmation is idempotent');
SELECT is((SELECT count(*) FROM public.digital_access WHERE user_id='11000000-0000-4000-8000-000000000001'),1::bigint,'duplicate confirmation does not duplicate entitlement');
SELECT throws_ok($$SELECT * FROM public.confirm_razorpay_payment((SELECT id FROM public.payments WHERE provider_order_id='order_SYNTHETIC1001'),'order_SYNTHETIC1001','pay_SYNTHETIC9999')$$,'P0001',NULL,'mismatched provider payment is rejected');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_CAPTURE1','payment.captured','{}','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','order_SYNTHETIC1001','pay_SYNTHETIC1001')$$,'capture webhook claimed');
SELECT lives_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_CAPTURE1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','order_SYNTHETIC1001','pay_SYNTHETIC1001',10000,'USD')$$,'captured payment reconciles');
SELECT lives_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_CAPTURE1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','order_SYNTHETIC1001','pay_SYNTHETIC1001',10000,'USD')$$,'captured reconciliation replay is idempotent');

SELECT lives_ok($$SELECT * FROM public.begin_razorpay_refund_webhook_event('evt_SYNTHETIC_REFUND1','{}','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','pay_SYNTHETIC1001','rfnd_SYNTHETIC1001')$$,'partial refund webhook claimed');
SELECT lives_ok($$SELECT * FROM public.reconcile_processed_razorpay_refund('evt_SYNTHETIC_REFUND1','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','rfnd_SYNTHETIC1001','pay_SYNTHETIC1001',2500,'USD',now())$$,'partial refund reconciles');
RESET ROLE;
SELECT is((SELECT status::text FROM public.payments WHERE provider_payment_id='pay_SYNTHETIC1001'),'partially_refunded','partial refund updates payment');
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_refund_webhook_event('evt_SYNTHETIC_REFUND_CONFLICT','{}','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','pay_SYNTHETIC1001','rfnd_SYNTHETIC1001')$$,'conflicting refund delivery is claimed independently');
SELECT throws_ok($$SELECT * FROM public.reconcile_processed_razorpay_refund('evt_SYNTHETIC_REFUND_CONFLICT','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','rfnd_SYNTHETIC1001','pay_SYNTHETIC1001',2501,'USD',now())$$,'P0001',NULL,'conflicting provider refund identity is rejected');

SELECT lives_ok($$SELECT * FROM public.begin_razorpay_refund_webhook_event('evt_SYNTHETIC_REFUND2','{}','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','pay_SYNTHETIC1001','rfnd_SYNTHETIC1002')$$,'full refund webhook is claimed');
SELECT lives_ok($$SELECT * FROM public.reconcile_processed_razorpay_refund('evt_SYNTHETIC_REFUND2','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','rfnd_SYNTHETIC1002','pay_SYNTHETIC1001',7500,'USD',now())$$,'remaining full refund reconciles');
RESET ROLE;
SELECT is((SELECT status::text FROM public.digital_access WHERE user_id='11000000-0000-4000-8000-000000000001'),'revoked','full refund revokes entitlement');

-- P1-004: a failed payment.captured receipt is reclaimed without changing its identity.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$SELECT * FROM public.create_pending_evo_vault_order('41000000-0000-4000-8000-000000000002','USD')$$,'recovery checkout created');
SELECT lives_ok($$SELECT * FROM public.reserve_razorpay_payment((SELECT o.id FROM public.orders o JOIN public.order_items i ON i.order_id=o.id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000002'))$$,'recovery payment reserved');
SELECT lives_ok($$SELECT * FROM public.attach_razorpay_order((SELECT p.id FROM public.payments p JOIN public.order_items i ON i.order_id=p.order_id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000002'),'order_SYNTHETICRECOVER1')$$,'recovery provider order attached');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_RECOVER_CAPTURE','payment.captured','{"event":"payment.captured","synthetic":true}','1111111111111111111111111111111111111111111111111111111111111111','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1')$$,'initial captured receipt claimed');
SELECT lives_ok($$SELECT public.fail_razorpay_webhook_event('evt_SYNTHETIC_RECOVER_CAPTURE','1111111111111111111111111111111111111111111111111111111111111111','synthetic_provider_outage')$$,'captured receipt marked failed through bounded RPC');
RESET ROLE;
SELECT is((SELECT processing_status||':'||attempt_count||':'||safe_error_code||':'||(processed_at IS NULL)::text FROM public.payment_webhook_events WHERE provider_event_id='evt_SYNTHETIC_RECOVER_CAPTURE'),'failed:1:synthetic_provider_outage:true','failed receipt records bounded error, null processed time, and first attempt');
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_RECOVER_CAPTURE','payment.captured','{"event":"payment.captured","synthetic":true}','1111111111111111111111111111111111111111111111111111111111111111','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1')$$,'exact failed captured receipt reclaimed');
RESET ROLE;
SELECT is((SELECT processing_status||':'||attempt_count||':'||(safe_error_code IS NULL)::text FROM public.payment_webhook_events WHERE provider_event_id='evt_SYNTHETIC_RECOVER_CAPTURE'),'processing:2:true','reclaim increments once and clears safe error');
SELECT is((SELECT count(*) FROM public.payment_webhook_events WHERE provider='razorpay' AND provider_event_id='evt_SYNTHETIC_RECOVER_CAPTURE' AND event_type='payment.captured' AND payload='{"event":"payment.captured","synthetic":true}'::jsonb AND payload_sha256='1111111111111111111111111111111111111111111111111111111111111111' AND provider_order_id='order_SYNTHETICRECOVER1' AND provider_payment_id='pay_SYNTHETICRECOVER1'),1::bigint,'reclaim preserves one immutable receipt identity');
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_RECOVER_CAPTURE','1111111111111111111111111111111111111111111111111111111111111111','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1',10000,'USD')$$,'reclaimed captured receipt reconciles');
RESET ROLE;
SELECT is((SELECT p.status::text||':'||o.status::text||':'||o.payment_status::text FROM public.payments p JOIN public.orders o ON o.id=p.order_id WHERE p.provider_order_id='order_SYNTHETICRECOVER1'),'paid:confirmed:paid','recovered capture atomically pays and confirms');
SELECT is((SELECT processing_status||':'||(processed_at IS NOT NULL)::text||':'||(safe_error_code IS NULL)::text FROM public.payment_webhook_events WHERE provider_event_id='evt_SYNTHETIC_RECOVER_CAPTURE'),'processed:true:true','recovered captured receipt is processed with bounded error cleared');
SELECT is((SELECT count(*) FROM public.digital_access a JOIN public.order_items i ON i.id=a.order_item_id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000002' AND a.status='active'),1::bigint,'recovered capture grants exactly one active entitlement');

-- order.paid independently fails, reclaims, and converges on the already fulfilled purchase.
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_RECOVER_ORDER','order.paid','{"event":"order.paid","synthetic":true}','2222222222222222222222222222222222222222222222222222222222222222','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1')$$,'order paid receipt claimed');
SELECT lives_ok($$SELECT public.fail_razorpay_webhook_event('evt_SYNTHETIC_RECOVER_ORDER','2222222222222222222222222222222222222222222222222222222222222222','synthetic_retryable_failure')$$,'order paid receipt marked failed');
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_RECOVER_ORDER','order.paid','{"event":"order.paid","synthetic":true}','2222222222222222222222222222222222222222222222222222222222222222','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1')$$,'failed order paid receipt reclaimed');
SELECT lives_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_RECOVER_ORDER','2222222222222222222222222222222222222222222222222222222222222222','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1',10000,'USD')$$,'reclaimed order paid receipt reconciles');
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_RECOVER_ORDER','order.paid','{"event":"order.paid","synthetic":true}','2222222222222222222222222222222222222222222222222222222222222222','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1')$$,'processed order paid receipt re-begin is idempotent');
SELECT lives_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_RECOVER_ORDER','2222222222222222222222222222222222222222222222222222222222222222','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1',10000,'USD')$$,'processed order paid reconciliation replay is idempotent');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.payment_webhook_events WHERE provider_event_id IN ('evt_SYNTHETIC_RECOVER_CAPTURE','evt_SYNTHETIC_RECOVER_ORDER') AND processing_status='processed'),2::bigint,'both capture event types remain individually auditable and processed');
SELECT is((SELECT count(*) FROM public.payments p JOIN public.order_items i ON i.order_id=p.order_id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000002'),1::bigint,'capture event convergence retains one payment');
SELECT is((SELECT count(DISTINCT o.id) FROM public.orders o JOIN public.order_items i ON i.order_id=o.id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000002'),1::bigint,'capture event convergence retains one order');
SELECT is((SELECT count(*) FROM public.digital_access a JOIN public.order_items i ON i.id=a.order_item_id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000002'),1::bigint,'processed replay and event convergence retain one entitlement');
SELECT is((SELECT processing_status||':'||attempt_count FROM public.payment_webhook_events WHERE provider_event_id='evt_SYNTHETIC_RECOVER_ORDER'),'processed:2','processed replay neither fails nor increments attempts');

-- Partial then full refund protections reject fresh capture events without commercial regression.
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_refund_webhook_event('evt_SYNTHETIC_RECOVER_REFUND1','{}','3333333333333333333333333333333333333333333333333333333333333333','pay_SYNTHETICRECOVER1','rfnd_SYNTHETICRECOVER1')$$,'recovery partial refund claimed');
SELECT lives_ok($$SELECT * FROM public.reconcile_processed_razorpay_refund('evt_SYNTHETIC_RECOVER_REFUND1','3333333333333333333333333333333333333333333333333333333333333333','rfnd_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1',2500,'USD',now())$$,'recovery partial refund reconciles');
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_AFTER_PARTIAL','payment.captured','{}','4444444444444444444444444444444444444444444444444444444444444444','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1')$$,'post-partial capture receipt claimed');
SELECT throws_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_AFTER_PARTIAL','4444444444444444444444444444444444444444444444444444444444444444','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1',10000,'USD')$$,'P0001',NULL,'partial refund cannot regress through capture recovery');
RESET ROLE;
SELECT ok((SELECT p.refunded_amount = 25::numeric AND p.status = 'partially_refunded'
  AND o.status = 'confirmed' AND o.payment_status = 'partially_refunded'
  FROM public.payments p JOIN public.orders o ON o.id=p.order_id
  WHERE p.provider_order_id='order_SYNTHETICRECOVER1'),
  'partial refund amount and commercial state remain intact');
SELECT is((SELECT count(*)::text||':'||min(a.status::text) FROM public.payment_refunds r JOIN public.payments p ON p.id=r.payment_id JOIN public.order_items i ON i.order_id=p.order_id JOIN public.digital_access a ON a.order_item_id=i.id WHERE p.provider_order_id='order_SYNTHETICRECOVER1'),'1:active','partial refund history and entitlement remain intact');
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_refund_webhook_event('evt_SYNTHETIC_RECOVER_REFUND2','{}','5555555555555555555555555555555555555555555555555555555555555555','pay_SYNTHETICRECOVER1','rfnd_SYNTHETICRECOVER2')$$,'recovery full refund claimed');
SELECT lives_ok($$SELECT * FROM public.reconcile_processed_razorpay_refund('evt_SYNTHETIC_RECOVER_REFUND2','5555555555555555555555555555555555555555555555555555555555555555','rfnd_SYNTHETICRECOVER2','pay_SYNTHETICRECOVER1',7500,'USD',now())$$,'recovery full refund reconciles');
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_AFTER_FULL','order.paid','{}','6666666666666666666666666666666666666666666666666666666666666666','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1')$$,'post-full-refund capture receipt claimed');
SELECT throws_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_AFTER_FULL','6666666666666666666666666666666666666666666666666666666666666666','order_SYNTHETICRECOVER1','pay_SYNTHETICRECOVER1',10000,'USD')$$,'P0001',NULL,'full refund cannot regress through capture recovery');
RESET ROLE;
SELECT ok((SELECT p.refunded_amount = 100::numeric AND p.status = 'refunded'
  AND o.status = 'refunded' AND o.payment_status = 'refunded'
  FROM public.payments p JOIN public.orders o ON o.id=p.order_id
  WHERE p.provider_order_id='order_SYNTHETICRECOVER1'),
  'full refund amount and commercial state remain intact');
SELECT is((SELECT count(*)::text||':'||min(a.status::text)||':'||(min(a.revoked_at) IS NOT NULL)::text FROM public.payment_refunds r JOIN public.payments p ON p.id=r.payment_id JOIN public.order_items i ON i.order_id=p.order_id JOIN public.digital_access a ON a.order_item_id=i.id WHERE p.provider_order_id='order_SYNTHETICRECOVER1'),'2:revoked:true','full refund history remains and capture cannot reactivate entitlement');

-- Expiry recovery is accepted only for the exact expiry-generated failed/cancelled state.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$SELECT * FROM public.create_pending_evo_vault_order('41000000-0000-4000-8000-000000000003','USD')$$,'expiry recovery checkout created');
SELECT lives_ok($$SELECT * FROM public.reserve_razorpay_payment((SELECT o.id FROM public.orders o JOIN public.order_items i ON i.order_id=o.id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000003'))$$,'expiry recovery payment reserved');
SELECT lives_ok($$SELECT * FROM public.attach_razorpay_order((SELECT p.id FROM public.payments p JOIN public.order_items i ON i.order_id=p.order_id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000003'),'order_SYNTHETICEXPIRED1')$$,'expiry recovery provider order attached');
RESET ROLE;
UPDATE public.orders SET checkout_expires_at=now()-interval '1 second' WHERE id=(SELECT order_id FROM public.payments WHERE provider_order_id='order_SYNTHETICEXPIRED1');
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT public.expire_pending_evo_vault_checkouts(100)$$,'bounded expiry marks checkout');
RESET ROLE;
SELECT is((SELECT p.status::text||':'||o.status::text||':'||o.payment_status::text||':'||(o.checkout_expired_at IS NOT NULL)::text FROM public.payments p JOIN public.orders o ON o.id=p.order_id WHERE p.provider_order_id='order_SYNTHETICEXPIRED1'),'failed:cancelled:failed:true','expiry creates the precise recoverable state');
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_EXPIRED_CAPTURE','payment.captured','{}','7777777777777777777777777777777777777777777777777777777777777777','order_SYNTHETICEXPIRED1','pay_SYNTHETICEXPIRED1')$$,'expired captured receipt claimed');
SELECT lives_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_EXPIRED_CAPTURE','7777777777777777777777777777777777777777777777777777777777777777','order_SYNTHETICEXPIRED1','pay_SYNTHETICEXPIRED1',10000,'USD')$$,'precise expired captured checkout recovers');
RESET ROLE;
SELECT is((SELECT p.status::text||':'||o.status::text||':'||o.payment_status::text FROM public.payments p JOIN public.orders o ON o.id=p.order_id WHERE p.provider_order_id='order_SYNTHETICEXPIRED1'),'paid:confirmed:paid','expired capture recovery pays and confirms');
SELECT is((SELECT count(*) FROM public.digital_access a JOIN public.order_items i ON i.id=a.order_item_id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000003' AND a.status='active'),1::bigint,'expired capture recovery grants one entitlement');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$SELECT * FROM public.create_pending_evo_vault_order('41000000-0000-4000-8000-000000000004','USD')$$,'non-expiry cancelled checkout created');
SELECT lives_ok($$SELECT * FROM public.reserve_razorpay_payment((SELECT o.id FROM public.orders o JOIN public.order_items i ON i.order_id=o.id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000004'))$$,'non-expiry cancelled payment reserved');
SELECT lives_ok($$SELECT * FROM public.attach_razorpay_order((SELECT p.id FROM public.payments p JOIN public.order_items i ON i.order_id=p.order_id WHERE i.vault_product_id='41000000-0000-4000-8000-000000000004'),'order_SYNTHETICCANCELLED1')$$,'non-expiry cancelled provider order attached');
RESET ROLE;
UPDATE public.payments SET status='failed' WHERE provider_order_id='order_SYNTHETICCANCELLED1';
UPDATE public.orders SET status='cancelled',payment_status='failed',checkout_expired_at=NULL WHERE id=(SELECT order_id FROM public.payments WHERE provider_order_id='order_SYNTHETICCANCELLED1');
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_webhook_event('evt_SYNTHETIC_CANCELLED_CAPTURE','payment.captured','{}','8888888888888888888888888888888888888888888888888888888888888888','order_SYNTHETICCANCELLED1','pay_SYNTHETICCANCELLED1')$$,'non-expiry cancelled captured receipt claimed');
SELECT throws_ok($$SELECT * FROM public.reconcile_captured_razorpay_payment('evt_SYNTHETIC_CANCELLED_CAPTURE','8888888888888888888888888888888888888888888888888888888888888888','order_SYNTHETICCANCELLED1','pay_SYNTHETICCANCELLED1',10000,'USD')$$,'P0001',NULL,'arbitrary failed cancelled checkout cannot be resurrected');
RESET ROLE;
SELECT is((SELECT p.status::text||':'||o.status::text||':'||o.payment_status::text||':'||(o.checkout_expired_at IS NULL)::text FROM public.payments p JOIN public.orders o ON o.id=p.order_id WHERE p.provider_order_id='order_SYNTHETICCANCELLED1'),'failed:cancelled:failed:true','rejected broad recovery leaves cancelled checkout unchanged');

SELECT * FROM finish();
ROLLBACK;
