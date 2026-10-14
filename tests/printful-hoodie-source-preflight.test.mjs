import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
test('hoodie media/price inspection remains read-only and cannot authorize publishing',async()=>{
 const source=await readFile(new URL('../src/lib/printful/hoodie-media-price-preflight.ts',import.meta.url),'utf8')
 const actions=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
 assert.match(source,/HOODIE_SYNC_ID = 481420111/)
 assert.match(source,/verifyPrintfulStoreIdentity/)
 assert.match(source,/getPrintfulProductDetail/)
 assert.match(source,/previewPrintfulMedia/)
 assert.match(source,/PRODUCT_OR_VARIANTS_CHANGED/)
 assert.match(source,/PRESENT_UNVERIFIED_CURRENCY/)
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.upsert\(|\.rpc\(|method:\s*'POST'/)
 assert.match(actions,/inspectHoodieMediaAndRetail\(\) \{\s*await requireAdmin\(\)/)
 assert.match(page,/<HoodieMediaPricingPreflight \/>/)
})
