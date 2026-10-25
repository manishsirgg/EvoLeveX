import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('product readiness issues link to the appropriate editable section',async()=>{
 const page=await readFile(new URL('../src/app/admin/store/products/[id]/page.tsx',import.meta.url),'utf8')
 for(const text of ["id=\"store-product-core\"","id=\"store-product-images\"","id=\"store-product-variants\"","code.includes('IMAGE')","code.includes('VARIANT')","code.includes('PRICE')","code.includes('INVENTORY')","href={readinessAnchor(issue.code)}","getStoreReadinessMessage(issue.code)"]){
  assert.ok(page.includes(text),text)
 }
 assert.ok(page.includes("await requireAdmin()"))
})
