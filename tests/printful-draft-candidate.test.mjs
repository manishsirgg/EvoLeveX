import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePrintfulDraftCandidate } from '../src/lib/printful/draft-candidate.ts'

const base = () => ({
  id: 1234,
  name: 'Short Sleeve T-shirt',
  variants: [
    { syncId: 111, catalogId: 222, name: 'Short Sleeve T-shirt / Black / S', sku: 'TEST-BLACK-S', synced: true },
    { syncId: 112, catalogId: 223, name: 'Short Sleeve T-shirt / Black / M', sku: 'TEST-BLACK-M', synced: true },
  ],
})

test('normalizes configured variants without producing any persistence side effect', () => {
  const result = normalizePrintfulDraftCandidate(base())
  assert.equal(result.slug, 'printful-1234')
  assert.equal(result.variants.length, 2)
  assert.equal(result.variants[0].size, 'S')
  assert.equal(result.variants[0].color, 'BLACK')
  assert.equal(result.variants[0].syncId, '111')
})

test('rejects repeated Printful sync variant identity', () => {
  const input = base()
  input.variants[1].syncId = input.variants[0].syncId
  assert.throws(() => normalizePrintfulDraftCandidate(input), /INVALID_PRINTFUL_VARIANT/)
})

test('rejects duplicate SKU and unconfigured variants', () => {
  const input = base()
  input.variants[1].sku = input.variants[0].sku
  assert.throws(() => normalizePrintfulDraftCandidate(input), /INVALID_PRINTFUL_SKU/)
  const other = base()
  other.variants[0].synced = false
  assert.throws(() => normalizePrintfulDraftCandidate(other), /INVALID_PRINTFUL_VARIANT/)
})

test('rejects ambiguous dimensions rather than guessing', () => {
  const input = base()
  input.variants[0].name = 'Mystery'
  assert.throws(() => normalizePrintfulDraftCandidate(input), /UNRESOLVED_VARIANT_DIMENSIONS/)
})
