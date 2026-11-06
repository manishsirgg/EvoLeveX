import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('variant admin surfaces concrete setup deficits and filters attention items',async()=>{
 const page=await readFile(new URL('../src/app/admin/store/products/product-variant-manager.tsx',import.meta.url),'utf8')
 for(const marker of ['showNeedsSetupOnly','setShowNeedsSetupOnly','active_positive_price_count < 1','!variant.inventory_configured','!variant.weight_g','!variant.is_active','visibleVariants.map','Show only variants needing setup','inventory counts are not evidence of Printful stock'])
  assert.ok(page.includes(marker),marker)
 assert.ok(page.includes('setStoreProductVariantActiveState'))
})
