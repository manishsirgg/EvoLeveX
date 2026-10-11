import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('cost inspection uses a fixed product, read-only upstream endpoints and no writes', async () => {
 const src=await readFile(new URL('../src/lib/printful/cost-assessment.ts', import.meta.url),'utf8')
 assert.match(src,/PRODUCT_ID = 479728769/)
 assert.match(src,/verifyPrintfulStoreIdentity/)
 assert.match(src,/variants\.length !== 18/)
 assert.match(src,/method: 'GET'/)
 assert.match(src,/cache: 'no-store'/)
 assert.match(src,/price fields|providerPrice/)
 assert.doesNotMatch(src,/\.rpc\(|\.insert\(|\.update\(|\.upsert\(|method: 'POST'|method: 'PATCH'/)
})
test('administrator boundary enforced on server action',async()=>{
 const src=await readFile(new URL('../src/app/admin/store/printful/actions.ts', import.meta.url),'utf8')
 assert.match(src,/export async function inspectPrintfulCostAssessment\(\) \{\s*await requireAdmin\(\)/)
 const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx', import.meta.url),'utf8')
 assert.match(page,/await requireAdmin\(\)/)
 assert.match(page,/<CostInspectionControl \/>/)
})
