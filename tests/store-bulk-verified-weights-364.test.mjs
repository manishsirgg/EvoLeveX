import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('merchant-verified weight RPC requires staff, draft product and complete variants',async()=>{
 const sql=await read('supabase/migrations/20261106180000_store_bulk_verified_draft_weights.sql')
 for(const needle of [
  'security definer',"auth.uid() is null","private.is_staff()",
  "publication_status='draft'","product_mode='physical'",
  'v_variants<>v_count','STORE_WEIGHT_ALREADY_CONFIGURED',
  'STORE_WEIGHT_DUPLICATE_VARIANT','STORE_WEIGHT_FOREIGN_VARIANT',
  'v.weight_g is null','revoke all on function public.seed_evo_store_verified_draft_weights',
  'grant execute on function public.seed_evo_store_verified_draft_weights',
 ])assert.ok(sql.includes(needle),needle)
 assert.ok(sql.indexOf('STORE_WEIGHT_FOREIGN_VARIANT')<sql.indexOf('update public.evo_store_variants'))
 assert.doesNotMatch(sql,/set is_active\s*=\s*true|set publication_status|insert into public.evo_store_inventory/i)
})
test('bulk weights UI is admin-only, explicit, and never fills guessed weights',async()=>{
 const action=await read('src/app/admin/store/products/bulk-draft-weight-actions.ts')
 const form=await read('src/app/admin/store/products/bulk-draft-weight-manager.tsx')
 const page=await read('src/app/admin/store/products/[id]/page.tsx')
 assert.ok(action.includes('await requireAdmin()'))
 assert.ok(action.includes('if(!confirmed)'))
 assert.ok(action.includes("db.rpc('seed_evo_store_verified_draft_weights'"))
 assert.ok(form.includes('alreadyConfigured.length===0'))
 assert.ok(form.includes('!canSave||!confirmed||pending'))
 assert.ok(form.includes('window.confirm('))
 assert.ok(form.includes('I verified every packed shipping weight'))
 assert.ok(page.includes("product.publication_status === 'draft'"))
 assert.ok(page.includes('<BulkDraftWeightManager'))
})
