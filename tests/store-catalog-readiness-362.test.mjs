import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('Store catalog readiness uses scoped read-only tables and excludes unpublished data mutations',async()=>{
 const query=await read('src/lib/store-catalog-readiness.ts')
 const page=await read('src/app/admin/store/readiness/page.tsx')
 const dashboard=await read('src/app/admin/store/page.tsx')
 for(const s of ["import 'server-only'","from('evo_store_products')","from('evo_store_variants')","from('evo_store_variant_prices')","from('evo_store_inventory')","p.is_active","Number(p.amount)>0","missingWeight","missingInventory","missingActivePrice"])
  assert.ok(query.includes(s),s)
 assert.doesNotMatch(query,/\.insert\(|\.update\(|\.delete\(|\.rpc\(|createAdminClient/)
 assert.ok(page.indexOf('await requireAdmin()')<page.indexOf('await getStoreCatalogReadiness()'))
 assert.ok(page.includes('Catalog readiness'))
 assert.ok(page.includes('Prepare variants'))
 assert.ok(page.includes("product.variantCount===0"))
 assert.ok(page.includes('not be invented for print-on-demand products'))
 assert.ok(dashboard.includes("href: '/admin/store/readiness'"))
})
