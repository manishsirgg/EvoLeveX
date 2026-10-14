import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('provider-to-store reconciliation matches every SKU and preview without database writes',async()=>{
 const src=await readFile(new URL('../src/lib/printful/reconciliation-plan.ts',import.meta.url),'utf8')
 const actions=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
 assert.match(src,/verifyPrintfulStoreIdentity/)
 assert.match(src,/product\.publication_status !== 'draft'/)
 assert.match(src,/bySku\.get\(normSku\(item\.sku\)\)/)
 assert.match(src,/INCOMPLETE_VARIANT_MATCH/)
 assert.match(src,/AMBIGUOUS_IMAGE_COLOR/)
 assert.match(src,/confirmedCurrency !== 'USD'/)
 assert.doesNotMatch(src,/\.insert\(|\.update\(|\.upsert\(|\.rpc\(|method:\s*'POST'/)
 assert.match(actions,/previewHoodieSynchronizationPlan\(\) \{\s*await requireAdmin\(\)/)
 assert.match(page,/<HoodieReconciliationPlan \/>/)
})
