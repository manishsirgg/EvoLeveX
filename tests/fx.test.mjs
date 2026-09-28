import assert from 'node:assert/strict'
import test from 'node:test'

import { multiplyAndRoundDecimal } from '../src/lib/fx/decimal.ts'
import { FX_FRESH_FOR_MS, FX_MAX_AGE_MS, getRateFreshness, resolveCachedRate } from '../src/lib/fx/policy.ts'
import { normalizeRequiredRates } from '../src/lib/fx/provider-validation.ts'

test('provider validation rejects malformed and incomplete rate sets', () => {
  assert.throws(() => normalizeRequiredRates(null, ['EUR']))
  assert.throws(() => normalizeRequiredRates({ EUR: 0 }, ['EUR']))
  assert.throws(() => normalizeRequiredRates({ GBP: 0.8 }, ['EUR', 'GBP']))
  assert.deepEqual(normalizeRequiredRates({ EUR: 0.85, GBP: 0.75 }, ['EUR', 'GBP']), { EUR: '0.85', GBP: '0.75' })
})

test('freshness permits bounded stale fallback and rejects hard-expired rates', () => {
  const now = new Date('2026-09-28T12:00:00.000Z')
  assert.equal(getRateFreshness(new Date(now.getTime() - FX_FRESH_FOR_MS), now), 'fresh')
  assert.equal(getRateFreshness(new Date(now.getTime() - FX_FRESH_FOR_MS - 1), now), 'stale')
  assert.throws(() => getRateFreshness(new Date(now.getTime() - FX_MAX_AGE_MS - 1), now), /expired/)
  assert.throws(() => getRateFreshness(new Date(now.getTime() + 5 * 60 * 1000 + 1), now), /timestamp/)
})

test('rate resolution returns identity without a row and fails when a cross-rate is missing', () => {
  const now = new Date('2026-09-28T12:00:00.000Z')
  assert.equal(resolveCachedRate('USD', 'USD', null, now).rate, '1')
  assert.throws(() => resolveCachedRate('USD', 'EUR', null, now), /No trusted/)
})

test('decimal conversion rounds JPY and two-decimal currencies deterministically', () => {
  assert.equal(multiplyAndRoundDecimal('12.99', '150.5', 0), '1955')
  assert.equal(multiplyAndRoundDecimal('12.99', '95.927636643572', 2), '1246.10')
  assert.equal(multiplyAndRoundDecimal('12.99', '0.923456789012345678', 2), '12.00')
  assert.equal(multiplyAndRoundDecimal('12.99', '1', 2), '12.99')
})
