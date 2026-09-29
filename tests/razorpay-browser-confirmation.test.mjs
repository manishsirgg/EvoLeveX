import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { confirmCanonicalRazorpayPayment } from '../src/lib/razorpay-browser-confirmation.ts'

const expected = {
  paymentId: 'pay_12345678',
  orderId: 'order_12345678',
  amount: '95.93',
  currency: 'INR',
}
const captured = {
  id: expected.paymentId,
  order_id: expected.orderId,
  amount: 9593,
  currency: expected.currency,
  status: 'captured',
  captured: true,
  amount_refunded: 0,
  refund_status: null,
}

async function orchestrate(canonical = captured, options = {}) {
  let confirmations = 0
  let fetches = 0
  const result = await confirmCanonicalRazorpayPayment(expected, {
    verifyCheckoutSignature: () => options.signatureIsValid !== false,
    fetchPayment: async (paymentId) => {
      fetches += 1
      assert.equal(paymentId, expected.paymentId)
      if (options.fetchError) throw options.fetchError
      return canonical
    },
    isRetryableFetchError: (error) => error === options.fetchError,
    confirmPayment: async () => {
      confirmations += 1
      return options.confirmation ?? { payment_status: 'paid', order_status: 'confirmed' }
    },
  })
  return { result, confirmations, fetches }
}

test('canonical captured exact match is the only state that reaches atomic confirmation', async () => {
  const { result, confirmations } = await orchestrate()
  assert.equal(confirmations, 1)
  assert.deepEqual(result, {
    outcome: 'confirmed',
    confirmation: { payment_status: 'paid', order_status: 'confirmed' },
  })
})

test('uncaptured and mismatched canonical payments cannot reach confirmation', async () => {
  for (const [name, change] of [
    ['authorized', { status: 'authorized', captured: false }],
    ['failed', { status: 'failed', captured: false }],
    ['captured false', { captured: false }],
    ['payment ID mismatch', { id: 'pay_87654321' }],
    ['provider order ID mismatch', { order_id: 'order_87654321' }],
    ['amount mismatch', { amount: 9592 }],
    ['currency mismatch', { currency: 'USD' }],
  ]) {
    const { result, confirmations } = await orchestrate({ ...captured, ...change })
    assert.deepEqual(result, { outcome: 'incomplete' }, name)
    assert.equal(confirmations, 0, name)
  }
})

test('canonical provider fetch failure is bounded and cannot reach confirmation', async () => {
  const fetchError = new Error('provider payload must not escape')
  const { result, confirmations } = await orchestrate(captured, { fetchError })
  assert.deepEqual(result, { outcome: 'provider_unavailable', retryable: true })
  assert.equal(confirmations, 0)
})

test('invalid checkout signature fails before canonical fetch or confirmation', async () => {
  const { result, fetches, confirmations } = await orchestrate(captured, {
    signatureIsValid: false,
  })
  assert.deepEqual(result, { outcome: 'invalid_signature' })
  assert.equal(fetches, 0)
  assert.equal(confirmations, 0)
})

test('browser-first and webhook-first results both converge through the existing callback', async () => {
  const browserFirst = await orchestrate(captured, {
    confirmation: { payment_status: 'paid', order_status: 'confirmed', transition: 'created' },
  })
  const webhookFirst = await orchestrate(captured, {
    confirmation: { payment_status: 'paid', order_status: 'confirmed', transition: 'idempotent' },
  })
  assert.equal(browserFirst.confirmations, 1)
  assert.equal(webhookFirst.confirmations, 1)
  assert.equal(browserFirst.result.outcome, 'confirmed')
  assert.equal(webhookFirst.result.outcome, 'confirmed')
})

test('route verifies checkout signature before canonical fetch and confirmation', () => {
  const route = readFileSync(new URL(
    '../src/app/api/payments/razorpay/verify/route.ts', import.meta.url,
  ), 'utf8')
  const orchestration = readFileSync(new URL(
    '../src/lib/razorpay-browser-confirmation.ts', import.meta.url,
  ), 'utf8')
  const signature = orchestration.indexOf('dependencies.verifyCheckoutSignature()')
  const canonical = orchestration.indexOf('dependencies.fetchPayment(expected.paymentId)')
  const confirmation = orchestration.indexOf('dependencies.confirmPayment()')
  assert.ok(signature >= 0 && signature < canonical && canonical < confirmation)
  assert.match(route, /verifyCheckoutSignature: \(\) => verifyRazorpayCheckoutSignature\(/)
  assert.match(route, /confirmPayment: async \(\) => supabase\.rpc\('confirm_razorpay_payment'/)
  assert.match(route, /if \(result\.outcome === 'invalid_signature'\)/)
})

test('browser contract cannot supply authoritative payment facts', () => {
  const route = readFileSync(new URL(
    '../src/app/api/payments/razorpay/verify/route.ts', import.meta.url,
  ), 'utf8')
  assert.match(route, /const BODY_KEYS = \['paymentId', 'razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature'\]\.sort\(\)/)
  assert.match(route, /\.select\('provider_order_id, amount, currency'\)/)
  assert.doesNotMatch(route, /value\.(amount|currency|status|captured|orderId)/)
})
