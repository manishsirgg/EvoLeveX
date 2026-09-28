import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260928030000_fulfill_confirmed_vault_orders.sql',
  import.meta.url,
), 'utf8')

const helper = migration.slice(
  migration.indexOf('create function public.fulfill_confirmed_evo_vault_order'),
  migration.indexOf('create or replace function public.confirm_razorpay_payment'),
)
const confirmation = migration.slice(
  migration.indexOf('create or replace function public.confirm_razorpay_payment'),
)

test('confirmed paid Razorpay Vault orders grant the canonical active permanent entitlement', () => {
  assert.match(helper, /v_order\.status is distinct from 'confirmed'/)
  assert.match(helper, /v_order\.payment_status is distinct from 'paid'/)
  assert.match(helper, /payment\.provider = 'razorpay'[\s\S]*payment\.status = 'paid'/)
  assert.match(helper, /payment\.provider_order_id is not null/)
  assert.match(helper, /payment\.provider_payment_id is not null/)
  assert.match(helper, /insert into public\.digital_access[\s\S]*v_order\.user_id, 'evo_vault'/)
  assert.match(helper, /'active', pg_catalog\.now\(\), null, null/)
})

test('fulfillment is conflict-safe, idempotent, and preserves ownership provenance', () => {
  assert.match(helper, /on conflict \(user_id, vault_product_id\) where vault_product_id is not null/)
  assert.match(helper, /where public\.digital_access\.status is distinct from 'active'/)
  assert.match(helper, /order_item_id is distinct from excluded\.order_item_id/)
  assert.doesNotMatch(helper, /do update set[\s\S]*order_item_id\s*=/)
  assert.doesNotMatch(helper, /do update set[\s\S]*granted_at\s*=/)
  assert.match(helper, /select access\.\* into v_existing[\s\S]*v_access_id := v_existing\.id/)
})

test('duplicate confirmation retries pass through atomic fulfillment', () => {
  assert.match(confirmation, /provider_payment_id is not distinct from v_provider_payment_id/)
  assert.match(confirmation, /Valid duplicate confirmation: fall through/)
  assert.match(confirmation, /perform public\.fulfill_confirmed_evo_vault_order\(v_order\.id\)/)
  assert.ok(confirmation.indexOf('perform public.fulfill_confirmed_evo_vault_order')
    < confirmation.indexOf('return query'))
})

test('unpaid, unconfirmed, malformed, and non-Vault orders are ineligible', () => {
  assert.match(helper, /confirmed_at is null/)
  assert.match(helper, /payment\.paid_at is not null/)
  assert.match(helper, /count\(\*\)[\s\S]*<> 1/)
  assert.match(helper, /item\.order_id = v_order\.id/)
  assert.match(helper, /item\.source = 'evo_vault'/)
  assert.match(helper, /item\.quantity = 1/)
  assert.match(helper, /item\.vault_product_id is not null/)
  assert.match(helper, /item\.store_variant_id is null/)
  assert.match(helper, /product\.kind = 'book'/)
  assert.match(helper, /product\.product_mode = 'digital'/)
})

test('payment confirmation retains authenticated order ownership and provider reconciliation', () => {
  assert.match(confirmation, /v_user_id uuid := auth\.uid\(\)/)
  assert.match(confirmation, /owned_order\.user_id = v_user_id/)
  assert.match(confirmation, /v_payment\.provider is distinct from 'razorpay'/)
  assert.match(confirmation, /v_payment\.provider_order_id is distinct from v_provider_order_id/)
  assert.match(confirmation, /v_payment\.amount is distinct from v_order\.total_amount/)
  assert.match(confirmation, /v_payment\.currency::text is distinct from v_order\.currency::text/)
})

test('entitlement authorization uses immutable relationships and statuses, not money, FX, or caller fields', () => {
  assert.doesNotMatch(helper, /unit_price|total_price|subtotal|total_amount|currency|exchange|fx|requested/i)
  assert.doesNotMatch(helper, /p_(product|user|price|amount|currency)/i)
  assert.match(helper, /p_order_id uuid/)
})

test('browser roles cannot execute recovery fulfillment or mutate digital_access', () => {
  assert.match(migration, /revoke all on function public\.fulfill_confirmed_evo_vault_order\(uuid\) from authenticated/)
  assert.match(migration, /grant execute on function public\.fulfill_confirmed_evo_vault_order\(uuid\) to service_role/)
  assert.match(migration, /revoke insert, update, delete on table public\.digital_access from anon/)
  assert.match(migration, /revoke insert, update, delete on table public\.digital_access from authenticated/)
  assert.doesNotMatch(migration, /grant (insert|update|delete)[\s\S]*digital_access[\s\S]*authenticated/i)
})

test('confirmation and fulfillment remain one database transaction without changing the RPC contract', () => {
  assert.match(confirmation, /p_payment_id uuid,[\s\S]*p_provider_order_id text,[\s\S]*p_provider_payment_id text/)
  assert.match(confirmation, /returns table \([\s\S]*payment_status public\.payment_status,[\s\S]*order_status public\.order_status/)
  assert.match(confirmation, /security definer[\s\S]*set search_path = ''/)
  assert.doesNotMatch(confirmation, /commit|dblink|http|service_role_key/i)
})
