import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Admin inventory reader matches production schema without nonexistent created_at',async()=>{
 const src=await readFile(new URL('../src/lib/admin-store.ts',import.meta.url),'utf8')
 const match=src.match(/supabase\.from\('evo_store_inventory'\)\.select\('([^']+)'\)/)
 assert.ok(match,'inventory select must be present')
 const cols=match[1].split(',')
 assert.deepEqual(cols,['variant_id','quantity_on_hand','quantity_reserved','low_stock_threshold','updated_at'])
 const type=src.match(/export type StoreAdminVariantInventory = \{([^}]+)\}/)?.[1]??''
 assert.doesNotMatch(type,/created_at/)
 assert.match(type,/low_stock_threshold/)
 assert.match(src,/if \(prices\.error \|\| inventory\.error\) return \{ variants: \[\], hasError: true \}/)
})
