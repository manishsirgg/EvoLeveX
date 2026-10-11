import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('shipping readiness is only a client-side design checkpoint', async () => {
 const src = await readFile(new URL('../src/app/admin/store/printful/shipping-readiness-control.tsx', import.meta.url), 'utf8')
 assert.match(src, /type Destination = 'IN' \| 'US'/)
 assert.match(src, /country_code: 'IN'/)
 assert.match(src, /country_code: 'US', state_code: 'CA'/)
 assert.match(src, /not a live quote/)
 assert.doesNotMatch(src, /\bfetch\s*\(|\.rpc\(|createClient\(|\.insert\(|\.update\(|\.upsert\(|shipping\/rates\x60/)
})
test('shipping readiness panel is within existing admin gate', async () => {
 const src = await readFile(new URL('../src/app/admin/store/printful/page.tsx', import.meta.url), 'utf8')
 assert.match(src, /await requireAdmin\(\)/)
 assert.match(src, /<ShippingReadinessControl \/>/)
})
