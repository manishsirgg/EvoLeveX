import assert from 'node:assert/strict'
import test from 'node:test'

import { toRazorpaySubunits } from '../src/lib/razorpay-money.ts'

test('converts two-decimal currencies without floating-point arithmetic', () => {
  assert.equal(toRazorpaySubunits('12.99', 'USD'), 1299)
  assert.equal(toRazorpaySubunits('1246.10', 'INR'), 124610)
  assert.throws(() => toRazorpaySubunits('1.001', 'USD'), /precision/)
})

test('normalizes only zero fractional digits for JPY', () => {
  assert.equal(toRazorpaySubunits('1955', 'JPY'), 1955)
  assert.equal(toRazorpaySubunits('1955.0', 'JPY'), 1955)
  assert.equal(toRazorpaySubunits('1955.00', 'JPY'), 1955)
  assert.equal(toRazorpaySubunits('1955.000', 'JPY'), 1955)
  for (const amount of ['1955.01', '1955.10', '1955.50', '1955.001']) {
    assert.throws(() => toRazorpaySubunits(amount, 'JPY'), /integral/)
  }
})

test('rejects unsupported, non-positive, negative, and unsafe amounts', () => {
  assert.throws(() => toRazorpaySubunits('1', 'CHF'), /Unsupported/)
  assert.throws(() => toRazorpaySubunits('0', 'JPY'), /range/)
  assert.throws(() => toRazorpaySubunits('-1', 'USD'), /Invalid/)
  assert.throws(() => toRazorpaySubunits('9007199254740992', 'JPY'), /range/)
})
