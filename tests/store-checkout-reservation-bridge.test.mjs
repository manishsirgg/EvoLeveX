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
  const page = await readFile(new URL('../src/app/(site)/store/checkout/page.tsx',import.meta.url),'utf8')
  assert.ok(page.includes("STORE_V1_RESERVATION_UI_ENABLED === 'true'"))
  assert.ok(page.includes("STORE_RESERVATION_BRIDGE_ENABLED === 'true'"))
  assert.ok(review.includes('if(!reservationEnabled||!readiness?.readyForOrderAttempt'))
  assert.ok(review.includes('/api/store/checkout/reserve'))
  assert.doesNotMatch(review,/razorpay\\.open|reserve_razorpay_payment|attach_razorpay_order/)
  assert.match(review,/<button type="button" disabled/)
})

test('checkout reservation currency argument matches PostgreSQL RPC signature', async () => {
  const route = await readFile(new URL('../src/app/api/store/checkout/reserve/route.ts',import.meta.url),'utf8')
  const migration = await readFile(new URL('../supabase/migrations/20261006010000_evo_store_transactional_inventory_reservations.sql',import.meta.url),'utf8')
  assert.match(migration,/create function public\.create_evo_store_checkout\([\s\S]*?p_items jsonb, p_currency text, p_idempotency_key uuid, p_address_id uuid/)
  assert.match(route,/rpc\('create_evo_store_checkout',[\s\S]*?p_currency: await getCurrencyPreference\(\)/)
  assert.doesNotMatch(route,/p_requested_currency:/)
})

test('checkout retries reuse one key for the same cart/address/currency within the mounted flow',async()=>{
  const review=await readFile(new URL('../src/components/store/store-checkout-review.tsx',import.meta.url),'utf8')
  assert.match(review,/reservationAttempt=useRef/)
  assert.match(review,/fingerprint=JSON\.stringify\(\{items,address_id:selectedAddress,currency\}\)/)
  assert.match(review,/reservationAttempt\.current\?\.fingerprint!==fingerprint/)
  assert.match(review,/idempotency_key:idempotencyKey/)
  assert.doesNotMatch(review,/idempotency_key:crypto\.randomUUID\(\)/)
  assert.match(review,/await response\.json\(\)/)
  assert.match(review,/setReservationResult\('failed'\)/)
})
