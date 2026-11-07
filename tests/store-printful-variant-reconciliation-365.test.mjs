import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('live SKU reconciliation is admin-only and read-only',async()=>{
 const action=await read('src/app/admin/store/products/printful-variant-reconciliation-action.ts')
 const page=await read('src/app/admin/store/products/[id]/page.tsx')
 const control=await read('src/app/admin/store/products/printful-variant-reconciliation-control.tsx')
 assert.ok(action.indexOf('await requireAdmin()')<action.indexOf("db.from('evo_store_variants')"))
 assert.ok(action.includes("getPrintfulProductDetail(PRINTFUL_SYNC_PRODUCT)"))
 assert.ok(action.includes(".eq('product_id',TSHIRT_ID)"))
 assert.doesNotMatch(action,/\.insert\(|\.update\(|\.delete\(|\.rpc\(|createAdminClient/)
 assert.ok(page.includes('<PrintfulVariantReconciliationControl />'))
 assert.ok(control.includes('Inspect variant mapping (read-only)'))
 assert.ok(control.includes('fulfilment remains unverified'))
})
test('reconciliation checks exact SKU identity, duplicates and Printful sync',async()=>{
 const code=await read('src/lib/printful/variant-reconciliation.ts')
 for(const marker of ['providerCounts','localCounts','duplicateLocal','duplicateProvider','unmatchedLocal','unmatchedProvider','unsynced','readyForMapping','!v.synced'])assert.ok(code.includes(marker),marker)
 assert.doesNotMatch(code,/\.insert\(|\.update\(|\.delete\(/)
})
