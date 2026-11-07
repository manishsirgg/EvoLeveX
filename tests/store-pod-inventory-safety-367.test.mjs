import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('Printful mapped variants cannot be assigned fictional on-hand warehouse stock',async()=>{
 const sql=await read('supabase/migrations/20261107110000_printful_no_fictitious_inventory.sql')
 for(const marker of [
  'private.guard_evo_store_printful_fictitious_inventory',
  'new.quantity_on_hand > 0','private.evo_store_printful_variant_maps',
  'PRINTFUL_WAREHOUSE_STOCK_NOT_SUPPORTED',
  'before insert or update of quantity_on_hand,variant_id on public.evo_store_inventory',
  'private.guard_evo_store_printful_mapping_existing_stock',
  'PRINTFUL_MAPPING_HAS_WAREHOUSE_STOCK',
  'before insert or update of variant_id on private.evo_store_printful_variant_maps',
  'pg_catalog.pg_advisory_xact_lock',
  'private.is_staff()',
  "grant execute on function public.is_evo_store_printful_mapped_product(uuid)",
 ])assert.ok(sql.includes(marker),marker)
 assert.ok(sql.match(/pg_catalog\.pg_advisory_xact_lock/g)?.length===2)
 assert.doesNotMatch(sql,/set publication_status|set is_active|create_razorpay_order|create_printful_order/i)
})
test('admin stock editor hides stock mutations for provider managed products',async()=>{
 const page=await read('src/app/admin/store/products/[id]/page.tsx')
 const variant=await read('src/app/admin/store/products/product-variant-manager.tsx')
 const inventory=await read('src/app/admin/store/products/product-variant-inventory-manager.tsx')
 assert.ok(page.includes("mappingDb.rpc('is_evo_store_printful_mapped_product'"))
 assert.ok(page.includes('providerManaged={printfulMappingError ? true : printfulManaged !== false}'))
 assert.ok(variant.includes('providerManaged={providerManaged}'))
 assert.ok(inventory.includes('providerManaged ? <p role="status"'))
 assert.ok(inventory.includes('local stock controls are disabled'))
})
