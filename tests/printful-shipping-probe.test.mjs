import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('shipping rate probe is gated, pinned, non-order and admin-only', async () => {
  const src = await readFile(new URL('../src/lib/printful/shipping-probe.ts', import.meta.url), 'utf8')
  const actions = await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url), 'utf8')
  const page = await readFile(new URL('../src/app/admin/store/printful/page.tsx', import.meta.url), 'utf8')
  assert.match(src, /PRINTFUL_SHIPPING_PROBE_ENABLED !== 'true'/)
  assert.match(src, /CATALOG_VARIANT_ID = 4866/)
  assert.match(src, /quantity: 1/)
  assert.match(src, /https:\/\/api\.printful\.com\/shipping\/rates/)
  assert.doesNotMatch(src, /https:\/\/api\.printful\.com\/orders|\.insert\(|\.update\(|\.upsert\(|\.rpc\(/)
  assert.match(actions, /export async function inspectShippingProbe\(country: 'IN' \| 'US'\) \{\s*await requireAdmin\(\)/)
  assert.match(page, /await requireAdmin\(\)/)
  assert.match(page, /<ShippingProbeControl enabled=\{/)
})
