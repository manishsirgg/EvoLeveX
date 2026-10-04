BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(38);

-- Fixed, obviously synthetic identities. auth.users is created by local Supabase.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','user-a@example.test','',now(),'{}','{}',now(),now()),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','user-b@example.test','',now(),'{}','{}',now(),now()),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@example.test','',now(),'{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles(id, username) VALUES
 ('10000000-0000-4000-8000-000000000001','user_a'),
 ('10000000-0000-4000-8000-000000000002','user_b'),
 ('10000000-0000-4000-8000-000000000003','admin_user') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles(id, code, name) VALUES
 ('20000000-0000-4000-8000-000000000001','admin','Administrator') ON CONFLICT (code) DO NOTHING;
INSERT INTO public.user_roles(user_id, role_id)
SELECT '10000000-0000-4000-8000-000000000003', id FROM public.roles WHERE code='admin'
ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_categories(id,name,slug) VALUES
 ('30000000-0000-4000-8000-000000000001','Synthetic','synthetic') ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_products(id,kind,name,slug,product_mode,price,currency,is_active,category_id) VALUES
 ('40000000-0000-4000-8000-000000000001','book','Ready Book','ready-book','digital',10,'USD',true,'30000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000002','book','Legacy Book','legacy-book','digital',10,'USD',true,'30000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000003','book','Free Book','free-book','digital',0,'USD',true,'30000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000004','course','Course','course','digital',10,'USD',true,'30000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000005','book','Physical Book','physical-book','physical',10,'USD',true,'30000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000006','book','Inactive Book','inactive-book','digital',10,'USD',false,'30000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000007','book','FX Book','fx-book','digital',10,'USD',true,'30000000-0000-4000-8000-000000000001');
INSERT INTO public.evo_vault_books(vault_product_id,digital_file_path,digital_file_size) VALUES
 ('40000000-0000-4000-8000-000000000001',null,null),
 ('40000000-0000-4000-8000-000000000002','legacy/private.pdf',999),
 ('40000000-0000-4000-8000-000000000003',null,null),
 ('40000000-0000-4000-8000-000000000005',null,null),
 ('40000000-0000-4000-8000-000000000006',null,null),
 ('40000000-0000-4000-8000-000000000007',null,null);
INSERT INTO public.evo_vault_book_assets(id,vault_product_id,title,file_path,file_size,is_primary,is_active) VALUES
 ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Synthetic PDF','vault/synthetic.pdf',100,true,true),
 ('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','Inactive PDF','vault/inactive.pdf',100,true,false),
 ('50000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000007','FX PDF','vault/fx.pdf',100,true,true);
INSERT INTO public.currency_exchange_rates(base_currency,quote_currency,rate,provider,fetched_at)
VALUES ('USD','EUR',0.9,'synthetic',now()-interval '73 hours');

SELECT ok(public.evo_vault_book_has_deliverable_pdf('40000000-0000-4000-8000-000000000001'), 'normalized active PDF establishes deliverability');
SELECT is(public.evo_vault_book_has_deliverable_pdf('40000000-0000-4000-8000-000000000002'), false, 'legacy fields alone do not establish deliverability');
SELECT is(public.evo_vault_book_has_deliverable_pdf('40000000-0000-4000-8000-000000000002'), false, 'inactive normalized asset does not establish deliverability');
SELECT throws_ok($$INSERT INTO public.evo_vault_book_assets(vault_product_id,title,file_path,file_size,mime_type) VALUES ('40000000-0000-4000-8000-000000000002','bad','bad.txt',1,'text/plain')$$, '23514', NULL, 'non-PDF asset is rejected');
SELECT throws_ok($$INSERT INTO public.evo_vault_book_assets(vault_product_id,title,file_path,file_size) VALUES ('40000000-0000-4000-8000-000000000002','empty','empty.pdf',0)$$, '23514', NULL, 'zero-size asset is rejected');

SET LOCAL ROLE anon;
SELECT is(current_user, 'anon', 'anon role is active');
SELECT is(auth.uid(), NULL::uuid, 'anon auth.uid is null');
SELECT is((SELECT count(*) FROM public.evo_vault_products), 6::bigint, 'anon sees active catalog products only');
SELECT is((SELECT count(*) FROM public.orders), 0::bigint, 'anon sees no customer orders');
SELECT throws_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000001','USD')$$, '42501', NULL, 'anon cannot execute checkout RPC');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT is(current_user, 'authenticated', 'authenticated role is active');
SELECT is(auth.uid(), '10000000-0000-4000-8000-000000000001'::uuid, 'user A auth.uid is explicit');
SELECT throws_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000001','CHF')$$, '22023', NULL, 'unsupported currency is rejected');
SELECT throws_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000006','USD')$$, NULL, NULL, 'inactive product is rejected');
SELECT throws_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000002','USD')$$, NULL, NULL, 'nondeliverable product is rejected despite legacy fields');
SELECT throws_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000004','USD')$$, NULL, NULL, 'nonbook product is rejected');
SELECT throws_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000005','USD')$$, NULL, NULL, 'nondigital product is rejected');
SELECT throws_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000003','USD')$$, NULL, NULL, 'free product is rejected');
SELECT throws_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000007','EUR')$$, NULL, NULL, 'stale trusted FX rate is rejected');
RESET ROLE;
UPDATE public.currency_exchange_rates SET fetched_at=now() WHERE base_currency='USD' AND quote_currency='EUR';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT lives_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000007','EUR')$$, 'fresh supported FX rate resolves checkout');
SELECT lives_ok($$SELECT * FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000001','USD')$$, 'user A creates pending checkout');
SELECT is((SELECT count(*) FROM public.create_pending_evo_vault_order('40000000-0000-4000-8000-000000000001','USD') WHERE created=false), 1::bigint, 'unexpired checkout is reused');
SELECT is((SELECT count(*) FROM public.orders), 2::bigint, 'user A sees both own orders');
SELECT lives_ok($$SELECT * FROM public.reserve_razorpay_payment((SELECT id FROM public.orders LIMIT 1))$$, 'payment reservation succeeds');
SELECT is((SELECT count(*) FROM public.reserve_razorpay_payment((SELECT id FROM public.orders LIMIT 1)) WHERE created=false), 1::bigint, 'payment reservation is idempotent');
SELECT is((SELECT count(*) FROM public.attach_razorpay_order((SELECT id FROM public.payments LIMIT 1),'order_SYNTHETIC0001') WHERE checkout_expired=false), 1::bigint, 'provider order attaches');
SELECT throws_ok($$SELECT * FROM public.attach_razorpay_order((SELECT id FROM public.payments LIMIT 1),'order_SYNTHETIC0002')$$, 'P0001', NULL, 'conflicting provider order is rejected');
SELECT throws_ok($$SELECT * FROM public.fulfill_confirmed_evo_vault_order((SELECT id FROM public.orders LIMIT 1))$$, '42501', NULL, 'authenticated cannot call service fulfillment');
SELECT is((SELECT count(*) FROM public.payment_refunds), 0::bigint, 'nonstaff cannot inspect refunds');
SELECT is((SELECT count(*) FROM public.payment_webhook_events), 0::bigint, 'nonstaff cannot inspect webhooks');

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SELECT is(auth.uid(), '10000000-0000-4000-8000-000000000002'::uuid, 'user B auth.uid is explicit');
SELECT is((SELECT count(*) FROM public.orders), 0::bigint, 'user B cannot see user A order');
SELECT throws_ok($$SELECT * FROM public.reserve_razorpay_payment((SELECT id FROM public.orders))$$, NULL, NULL, 'user B cannot operate on user A order');

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
SELECT ok(private.is_staff(), 'admin identity is staff');
SELECT is((SELECT count(*) FROM public.orders), 2::bigint, 'staff can see customer orders');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(current_user, 'service_role', 'service role is active');
SELECT lives_ok($$SELECT public.expire_pending_evo_vault_checkouts(10)$$, 'service role can invoke expiry RPC');
RESET ROLE;

SELECT throws_ok($$INSERT INTO public.payments(order_id,amount,currency) SELECT id,10,'USD' FROM public.orders$$, '23505', NULL, 'one payment per order/provider is enforced');

SELECT * FROM finish();
ROLLBACK;
