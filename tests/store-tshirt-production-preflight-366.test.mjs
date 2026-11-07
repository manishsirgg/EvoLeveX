import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('production audit is staff-only and strictly read-only',async()=>{
 const action=await read('src/app/admin/store/products/tshirt-production-preflight-action.ts')
 const page=await read('src/app/admin/store/products/[id]/page.tsx')
 const ui=await read('src/app/admin/store/products/tshirt-production-preflight-control.tsx')
 assert.ok(action.indexOf('await requireAdmin()')<action.indexOf("db.from('evo_store_products')"))
 for(const x of ["db.from('evo_store_variants')","db.from('evo_store_variant_prices')","db.from('evo_store_inventory')","getPrintfulProductDetail(PRINTFUL_ID)","inspectPrintfulProductionConfiguration()","reconcilePrintfulVariants(rows,upstream)"])
  assert.ok(action.includes(x),x)
 assert.doesNotMatch(action,/\.insert\(|\.update\(|\.delete\(|\.rpc\(|createAdminClient/)
 assert.ok(page.includes('<TshirtProductionPreflightControl />'))
 assert.ok(ui.includes('Commercial fulfilment authorization: NOT GRANTED'))
 assert.ok(ui.includes('Run production preflight'))
})
test('preflight distinguishes SKU, production files and local configuration without authorizing commerce',async()=>{
 const code=await read('src/lib/printful/tshirt-production-preflight.ts')
 for(const x of ['SKU_NOT_MATCHED','PROVIDER_NOT_SYNCED','PRODUCTION_FILES_MISSING','PRODUCTION_FILES_UNKNOWN','PRODUCTION_FILE_ID_MISSING','CATALOG_VARIANT_MISSING','WEIGHT_MISSING','ACTIVE_PRICE_MISSING','INVENTORY_UNCONFIGURED','PROVIDER_VARIANT_DUPLICATE','commerceReady:false'])
  assert.ok(code.includes(x),x)
 assert.doesNotMatch(code,/\.insert\(|\.update\(|\.delete\(/)
})
