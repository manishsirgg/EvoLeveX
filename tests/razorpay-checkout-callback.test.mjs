import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { parseRazorpayCheckoutCallback } from '../src/lib/razorpay-checkout-callback.ts'

const validCallback = {
  paymentId: '123e4567-e89b-12d3-a456-426614174000',
  razorpayOrderId: 'order_12345678',
  razorpayPaymentId: 'pay_12345678',
  razorpaySignature: 'a'.repeat(64),
}

test('checkout callback parser returns a fully typed validated value', () => {
  assert.deepEqual(parseRazorpayCheckoutCallback(validCallback), validCallback)
})

test('checkout callback parser rejects non-string values for every required callback field', () => {
  for (const field of Object.keys(validCallback)) {
    for (const malformed of [null, 1, false, {}, []]) {
      assert.equal(parseRazorpayCheckoutCallback({ ...validCallback, [field]: malformed }), null)
    }
  }
})

test('request validation precedes every payment side effect', () => {
  const route = readFileSync(new URL(
    '../src/app/api/payments/razorpay/verify/route.ts', import.meta.url,
  ), 'utf8')
  const validation = route.indexOf('parseRazorpayCheckoutCallback(body)')

  assert.ok(validation > -1)
  for (const operation of [
    'createClient()',
    'verifyRazorpayCheckoutSignature(',
    ".rpc('confirm_razorpay_payment'",
  ]) {
    assert.ok(validation < route.indexOf(operation), `${operation} must follow request validation`)
  }
})
