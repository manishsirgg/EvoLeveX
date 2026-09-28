import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatTrustedMoney,
  isTrustedCheckoutCallback,
  parseProviderOrderResponse,
  parseVaultOrderResponse,
  pricesMatch,
} from '../src/lib/vault-checkout.ts'

const orderId = '90560cea-31d3-4f30-a8f0-33ed7feb494a'
const paymentId = '2e1d16b8-3012-4d23-a4ed-b57becc93c8a'

test('validates and normalizes a trusted checkout response', () => {
  assert.deepEqual(parseVaultOrderResponse({ orderId, orderStatus: 'pending', paymentStatus: 'pending',
    currency: 'INR', totalAmount: '1246.1', created: false }), {
    orderId, orderStatus: 'pending', paymentStatus: 'pending', currency: 'INR',
    totalAmount: '1246.10', created: false,
  })
  assert.equal(parseVaultOrderResponse({ orderId, orderStatus: 'confirmed', paymentStatus: 'paid',
    currency: 'INR', totalAmount: '1246.10', created: true }), null)
})

test('formats trusted amounts and compares prices without floating-point money arithmetic', () => {
  assert.equal(formatTrustedMoney('1246.1', 'INR'), 'INR 1246.10')
  assert.equal(formatTrustedMoney('1955', 'JPY'), 'JPY 1955')
  assert.equal(pricesMatch({ amount: '12.9', currency: 'USD' }, { amount: '12.90', currency: 'USD' }), true)
  assert.equal(pricesMatch({ amount: '12.90', currency: 'USD' }, { amount: '12.91', currency: 'USD' }), false)
  assert.equal(pricesMatch({ amount: '12.90', currency: 'USD' }, { amount: '12.90', currency: 'EUR' }), false)
})

test('rejects malformed provider responses and unsupported currencies', () => {
  const valid = { orderId, paymentId, providerOrderId: 'order_ThTfGqhmrPAUub',
    amount: 124610, currency: 'INR', keyId: 'rzp_live_public' }
  assert.deepEqual(parseProviderOrderResponse(valid), valid)
  assert.equal(parseProviderOrderResponse({ ...valid, amount: 1246.1 }), null)
  assert.equal(parseProviderOrderResponse({ ...valid, currency: 'CHF' }), null)
  assert.equal(parseVaultOrderResponse({ orderId, orderStatus: 'pending', paymentStatus: 'pending',
    currency: 'CHF', totalAmount: '12.99', created: true }), null)
})

test('accepts only well-formed Razorpay callback identifiers and signatures', () => {
  const valid = { razorpay_order_id: 'order_ThTfGqhmrPAUub', razorpay_payment_id: 'pay_12345678',
    razorpay_signature: 'a'.repeat(64) }
  assert.equal(isTrustedCheckoutCallback(valid), true)
  assert.equal(isTrustedCheckoutCallback({ ...valid, razorpay_signature: 'not-a-signature' }), false)
})
