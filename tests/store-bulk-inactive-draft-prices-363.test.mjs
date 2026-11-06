import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('Bulk draft pricing RPC is staff-only, atomic and always inactive',async()=>{
 const sql=await read('supabase/migrations/20261106170000_store_bulk_inactive_draft_prices.sql')
 for(const term of [
  'security definer',"auth.uid() is null","private.is_staff()",
  "publication_status='draft' for update",
  'v_count <> v_variant_count','count(distinct',
  'STORE_PRICING_ALREADY_EXISTS',
  'insert into public.evo_store_variant_prices(variant_id,currency,amount,is_active)',
  "(item.v->>'amount')::numeric,false",
  'revoke all on function public.seed_evo_store_inactive_draft_prices',
  'grant execute on function public.seed_evo_store_inactive_draft_prices',
 ])assert.ok(sql.includes(term),term)
 assert.ok(sql.indexOf('if v_existing>0')<sql.indexOf('insert into public.evo_store_variant_prices'))
 assert.doesNotMatch(sql,/set is_active\s*=\s*true|publication_status\s*=\s*'published'|create_razorpay_order/i)
})
test('Merchant UI requires confirmed positive prices and never enables activation',async()=>{
 const action=await read('src/app/admin/store/products/bulk-draft-price-actions.ts')
 const component=await read('src/app/admin/store/products/bulk-draft-price-manager.tsx')
 const page=await read('src/app/admin/store/products/[id]/page.tsx')
 assert.ok(action.includes('await requireAdmin()'))
 assert.ok(action.includes('if(!confirmed)'))
 assert.ok(action.includes("supabase.rpc('seed_evo_store_inactive_draft_prices'"))
 assert.ok(component.includes('new Set')===false || component.includes('existing.length'))
 assert.ok(component.includes('!confirmed||!valid||pending'))
 assert.ok(component.includes('window.confirm('))
 assert.ok(component.includes('I verified each retail price'))
 assert.ok(page.includes("product.publication_status === 'draft'"))
 assert.ok(page.includes('<BulkDraftPriceManager'))
})
