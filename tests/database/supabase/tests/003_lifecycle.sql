BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(21);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
 email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('11000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','lifecycle@example.test','',now(),'{}','{}',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO public.profiles(id,username) VALUES ('11000000-0000-4000-8000-000000000001','lifecycle') ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_categories(id,name,slug) VALUES ('31000000-0000-4000-8000-000000000001','Lifecycle','lifecycle') ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_products(id,kind,name,slug,product_mode,price,currency,is_active,category_id)
VALUES ('41000000-0000-4000-8000-000000000001','book','Lifecycle Book','lifecycle-book','digital',100,'USD',true,'31000000-0000-4000-8000-000000000001');
INSERT INTO public.evo_vault_books(vault_product_id) VALUES ('41000000-0000-4000-8000-000000000001');
INSERT INTO public.evo_vault_book_assets(vault_product_id,title,file_path,file_size,is_primary)
VALUES ('41000000-0000-4000-8000-000000000001','PDF','vault/lifecycle.pdf',100,true);

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
SELECT is((SELECT status::text FROM public.payments WHERE provider_payment_id='pay_SYNTHETIC1001'),'partially_refunded','partial refund updates payment');
SELECT lives_ok($$SELECT * FROM public.begin_razorpay_refund_webhook_event('evt_SYNTHETIC_REFUND_CONFLICT','{}','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','pay_SYNTHETIC1001','rfnd_SYNTHETIC1001')$$,'conflicting refund delivery is claimed independently');
SELECT throws_ok($$SELECT * FROM public.reconcile_processed_razorpay_refund('evt_SYNTHETIC_REFUND_CONFLICT','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','rfnd_SYNTHETIC1001','pay_SYNTHETIC1001',2501,'USD',now())$$,'P0001',NULL,'conflicting provider refund identity is rejected');

SELECT lives_ok($$SELECT * FROM public.begin_razorpay_refund_webhook_event('evt_SYNTHETIC_REFUND2','{}','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','pay_SYNTHETIC1001','rfnd_SYNTHETIC1002')$$,'full refund webhook is claimed');
SELECT lives_ok($$SELECT * FROM public.reconcile_processed_razorpay_refund('evt_SYNTHETIC_REFUND2','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','rfnd_SYNTHETIC1002','pay_SYNTHETIC1001',7500,'USD',now())$$,'remaining full refund reconciles');
RESET ROLE;
SELECT is((SELECT status::text FROM public.digital_access WHERE user_id='11000000-0000-4000-8000-000000000001'),'revoked','full refund revokes entitlement');

SELECT * FROM finish();
ROLLBACK;
