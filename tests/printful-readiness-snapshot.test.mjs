import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Printful readiness panel is restricted to imported T-shirt and never initiates mutation',async()=>{
 const src=await readFile(new URL('../src/app/admin/store/products/printful-readiness-snapshot.tsx',import.meta.url),'utf8')
 assert.match(src,/product\.slug !== 'printful-479728769'/)
 assert.match(src,/imagesError|variantsError/)
 assert.match(src,/image\.sort_order === index/)
 assert.match(src,/ordered\[0\]\?\.is_primary === true/)
 assert.match(src,/variants\.length === 18/)
 assert.match(src,/variant\.is_active/)
 assert.match(src,/price\.is_active/)
 assert.match(src,/inventory_configured/)
 assert.match(src,/Not authorized; publication lock remains/)
 assert.doesNotMatch(src,/createClient|\.rpc\(|fetch\(|onClick|<form|<button/)
})
test('Snapshot uses already-authorized admin product data and does not alter publication',async()=>{
 const page=await readFile(new URL('../src/app/admin/store/products/[id]/page.tsx',import.meta.url),'utf8')
 assert.match(page,/await requireAdmin\(\)/)
 assert.match(page,/PrintfulReadinessSnapshot/)
 assert.match(page,/imagesError=\{imageResult\.hasError\}/)
 assert.match(page,/variantsError=\{variantResult\.hasError\}/)
})
