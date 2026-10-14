import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = async path => readFile(new URL(path,root),'utf8')

test('Vault captured-payment reconciler remains isolated from Store physical fulfillment',async()=>{
  const reconciliation=await read('src/lib/razorpay-captured-payment-reconciliation.ts')
  const bridge=await read('src/app/api/store/checkout/reserve/route.ts')
  assert.match(reconciliation,/reconcile_captured_razorpay_payment/)
  assert.doesNotMatch(bridge,/reserve_razorpay_payment|reconcile_captured_razorpay_payment|create_pending_evo_vault_order|fulfill_confirmed_evo_vault_order/)
  assert.match(bridge,/STORE_RESERVATION_BRIDGE_ENABLED !== 'true'/)
})

test('checkout review has no path to open Razorpay or consume reservations',async()=>{
  const review=await read('src/components/store/store-checkout-review.tsx')
  assert.match(review,/<button type="button" disabled/)
  assert.doesNotMatch(review,/checkout\/reserve|reserve_razorpay_payment|create_pending_evo_vault_order|razorpay\.open|verifyRazorpayCheckoutSignature/)
})

test('Store payment boundary documents stock and fulfillment reconciliation invariants',async()=>{
  const policy=await read('docs/store-physical-payment-boundary.md')
  for (const text of [
    'Shipping and tax', 'Late captures', 'Duplicate browser',
    'Evo Vault', 'quantity_reserved', 'quantity_on_hand',
  ]) {
    assert.ok(policy.includes(text),text)
  }
})
