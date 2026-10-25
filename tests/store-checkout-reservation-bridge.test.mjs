import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('store checkout reserve bridge is disabled by default, authenticated and nonpaying', async () => {
  const route = await readFile(new URL('../src/app/api/store/checkout/reserve/route.ts',import.meta.url),'utf8')
  for (const boundary of [
    "STORE_RESERVATION_BRIDGE_ENABLED !== 'true'",
    'isSameOrigin(request)', 'supabase.auth.getUser()',
    "rpc('create_evo_store_checkout'", 'getCurrencyPreference()',
    'normalizeStoreCartItems', 'idempotency_key', 'address_id', 'Cache-Control',
  ]) assert.ok(route.includes(boundary),boundary)
  assert.doesNotMatch(route, /service.role|createServiceRoleClient|reserve_razorpay_payment|attach_razorpay_order|capturePayment|fetchRazorpayPayment/)
})

test('checkout review permits only a gated unpaid reservation action', async () => {
  const review = await readFile(new URL('../src/components/store/store-checkout-review.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(review, /checkout\/reserve|create_evo_store_checkout/)
  assert.match(review, /<button type="button" disabled/)
})
