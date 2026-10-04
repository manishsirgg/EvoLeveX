BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(44);

SELECT has_type('public', 'commerce_source', 'commerce source enum exists');
SELECT has_type('public', 'digital_access_status', 'digital access enum exists');
SELECT has_type('public', 'order_status', 'order status enum exists');
SELECT has_type('public', 'payment_status', 'payment status enum exists');
SELECT has_type('public', 'payment_provider', 'payment provider enum exists');
SELECT has_type('public', 'vault_product_kind', 'Vault product kind enum exists');

SELECT has_table('public', name, name || ' exists') FROM unnest(ARRAY[
  'orders','order_items','payments','payment_refunds','payment_webhook_events',
  'digital_access','digital_download_logs','evo_vault_products','evo_vault_books',
  'evo_vault_book_assets'
]) name;

SELECT has_function('private', 'is_staff', ARRAY[]::name[], 'staff helper exists');
SELECT has_function('private', 'user_owns_order', ARRAY['uuid']::name[], 'order ownership helper exists');
SELECT has_function('public', 'create_pending_evo_vault_order', ARRAY['uuid','text']::name[], 'checkout RPC exists');
SELECT has_function('public', 'reserve_razorpay_payment', ARRAY['uuid']::name[], 'reservation RPC exists');
SELECT has_function('public', 'attach_razorpay_order', ARRAY['uuid','text']::name[], 'effective attachment RPC exists');
SELECT hasnt_function('public', 'attach_razorpay_provider_order', ARRAY['uuid','text']::name[], 'obsolete attachment name is absent');
SELECT has_function('public', 'confirm_razorpay_payment', ARRAY['uuid','text','text']::name[], 'confirmation RPC exists');
SELECT has_function('public', 'fulfill_confirmed_evo_vault_order', ARRAY['uuid']::name[], 'fulfillment RPC exists');
SELECT has_function('public', 'reconcile_captured_razorpay_payment', ARRAY['text','text','text','text','bigint','text']::name[], 'capture reconciliation exists');
SELECT has_function('public', 'recover_expired_captured_razorpay_payment', ARRAY['uuid','text','text','bigint','text']::name[], 'expired capture recovery exists');
SELECT has_function('public', 'expire_pending_evo_vault_checkouts', ARRAY['integer']::name[], 'expiry RPC exists');
SELECT has_function('public', 'reconcile_processed_razorpay_refund', ARRAY['text','text','text','text','bigint','text','timestamp with time zone']::name[], 'refund reconciliation exists');
SELECT has_function('public', 'evo_vault_book_has_deliverable_pdf', ARRAY['uuid']::name[], 'readiness helper exists');

SELECT ok((SELECT prosecdef AND proconfig = ARRAY['search_path=']
  FROM pg_proc WHERE oid = 'public.create_pending_evo_vault_order(uuid,text)'::regprocedure),
  'checkout RPC is security definer with empty search_path');
SELECT ok((SELECT prosecdef AND proconfig = ARRAY['search_path=']
  FROM pg_proc WHERE oid = 'public.reconcile_processed_razorpay_refund(text,text,text,text,bigint,text,timestamptz)'::regprocedure),
  'refund RPC is security definer with empty search_path');
SELECT col_is_fk('public', 'orders', 'user_id', 'orders belong to profiles');
SELECT col_is_fk('public', 'payments', 'order_id', 'payments belong to orders');
SELECT col_is_fk('public', 'payment_refunds', 'payment_id', 'refunds belong to payments');
SELECT col_is_fk('public', 'digital_access', 'order_item_id', 'entitlement provenance references order item');
SELECT has_index('public', 'payments', 'payments_order_id_provider_key', 'one payment per provider/order');
SELECT has_index('public', 'payment_webhook_events', 'payment_webhook_events_provider_event_key', 'provider event idempotency index exists');
SELECT has_index('public', 'payment_refunds', 'payment_refunds_provider_refund_key', 'provider refund idempotency index exists');
SELECT has_index('public', 'digital_access', 'digital_access_vault_uidx', 'canonical Vault entitlement partial index exists');
SELECT has_index('public', 'evo_vault_book_assets', 'evo_vault_book_assets_one_active_primary_idx', 'one active primary asset partial index exists');
SELECT has_index('public', 'orders', 'orders_expired_pending_checkout_idx', 'checkout expiry partial index exists');
SELECT trigger_is('public', 'evo_vault_book_assets', 'enforce_evo_vault_book_asset_publication_readiness', 'public', 'enforce_evo_vault_book_asset_publication_readiness', 'asset readiness trigger exists');
SELECT trigger_is('public', 'evo_vault_products', 'enforce_evo_vault_product_publication_readiness', 'public', 'enforce_evo_vault_product_publication_readiness', 'product readiness trigger exists');
SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid = ANY(ARRAY[
  'public.orders'::regclass,'public.order_items'::regclass,'public.payments'::regclass,
  'public.payment_refunds'::regclass,'public.payment_webhook_events'::regclass,
  'public.digital_access'::regclass,'public.digital_download_logs'::regclass
])), 'RLS is enabled on all private commerce tables');

SELECT * FROM finish();
ROLLBACK;
