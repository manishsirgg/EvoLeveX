import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260929080000_evo_vault_checkout_expiry.sql')
const providerRoute = read('src/app/api/payments/razorpay/orders/route.ts')
const confirmationRoute = read('src/app/api/payments/razorpay/verify/route.ts')

test('checkout deadlines are database-authored once and exact-match reuse is bounded', () => {
  assert.match(migration, /add column checkout_expires_at timestamptz/)
  assert.match(migration, /created_at \+ interval '30 minutes'/)
  assert.match(migration, /candidate\.checkout_expires_at > pg_catalog\.now\(\)/)
  assert.match(migration, /pg_catalog\.now\(\) \+ interval '30 minutes'/)
  assert.equal((migration.match(/pg_catalog\.now\(\) \+ interval '30 minutes'/g) ?? []).length, 1)
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*checkout_expires_at > pg_catalog\.now\(\)/)
})

test('lazy checkout and reservation expiry preserve snapshots and fail only pending money', () => {
  assert.match(migration, /set status = 'cancelled', payment_status = 'failed',[\s\S]*checkout_expired_at = pg_catalog\.now\(\)/)
  assert.match(migration, /update public\.payments[\s\S]*status = 'failed'[\s\S]*status = 'pending'/)
  assert.doesNotMatch(migration, /delete from public\.(orders|order_items|payments|digital_access)/)
  assert.match(migration, /return query select v_payment\.id[\s\S]*v_order\.checkout_expires_at, false/)
})

test('provider attachment preserves correlation across expiry and rejects continued checkout', () => {
  const attach = migration.slice(migration.indexOf('create function public.attach_razorpay_order'))
  assert.ok(attach.indexOf('set provider_order_id = v_provider_order_id') < attach.indexOf('checkout_expires_at <= pg_catalog.now()'))
  assert.match(attach, /Provider order reconciliation conflict/)
  assert.match(attach, /provider_order_id, true/)
  assert.match(providerRoute, /attached\.checkout_expired === true/)
})

test('bounded cleanup is service-only, skip-locked, and does not mutate fulfillment or snapshots', () => {
  const cleanup = migration.slice(migration.indexOf('create function public.expire_pending_evo_vault_checkouts'))
  assert.match(cleanup, /p_batch_size > 500/)
  assert.match(cleanup, /for update of candidate skip locked/)
  assert.match(cleanup, /checkout_expires_at <= pg_catalog\.now\(\)/)
  assert.match(cleanup, /revoke all[\s\S]*public, anon, authenticated/)
  assert.match(cleanup, /grant execute[\s\S]*to service_role/)
  assert.doesNotMatch(cleanup, /update public\.(order_items|digital_access)/)
})

test('canonical capture alone can recover the marked expiry state', () => {
  assert.match(confirmationRoute, /verifyRazorpayCheckoutSignature[\s\S]*fetchRazorpayPayment[\s\S]*validateCanonicalRazorpayPayment/)
  assert.match(confirmationRoute, /createServiceRoleClient[\s\S]*recover_expired_captured_razorpay_payment/)
  assert.match(migration, /recover_expired_captured_razorpay_payment[\s\S]*checkout_expired_at is null[\s\S]*Payment requires reconciliation/)
  assert.match(migration, /recover_expired_captured_razorpay_payment[\s\S]*revoke all[\s\S]*authenticated[\s\S]*grant execute[\s\S]*service_role/)
  assert.match(migration, /reconcile_captured_razorpay_payment[\s\S]*status = 'cancelled'[\s\S]*checkout_expired_at is not null/)
})

test('authenticated confirmation cannot revive elapsed state and refunds are excluded', () => {
  const confirm = migration.slice(migration.lastIndexOf('create or replace function public.confirm_razorpay_payment'))
  assert.match(confirm, /checkout_expires_at <= pg_catalog\.now\(\)[\s\S]*status = 'failed'[\s\S]*return;/)
  assert.match(confirm, /checkout_expired_at = pg_catalog\.now\(\)[\s\S]*return;/)
  assert.doesNotMatch(migration, /status\s+in\s*\([^)]*refunded[^)]*\)[\s\S]*status = 'paid'/i)
})
