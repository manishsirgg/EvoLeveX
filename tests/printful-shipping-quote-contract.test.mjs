import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('quote contract cannot execute HTTP or create orders', async () => {
  const src = await readFile(new URL('../src/lib/printful/shipping-quote-contract.ts', import.meta.url), 'utf8')
  assert.match(src, /validateShippingQuoteInput/)
  assert.match(src, /variant_id: input.catalogVariantId/)
  assert.match(src, /country_code: input.countryCode/)
  assert.match(src, /STATE_REQUIRED/)
  assert.match(src, /input.quantity > 10/)
  assert.doesNotMatch(src, /\bfetch\s*\(|process\.env|\.rpc\(|\.insert\(|\.update\(|\.upsert\(|\/orders\b|https:\/\//)
})
