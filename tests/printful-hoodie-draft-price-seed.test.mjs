import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('USD draft price seeding is admin-only, independently gated and transactionally non-overwriting',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261014010000_printful_draft_price_seed.sql',import.meta.url),'utf8')
 const actions=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const ui=await readFile(new URL('../src/app/admin/store/printful/hoodie-price-seed-control.tsx',import.meta.url),'utf8')
 assert.match(sql,/SECURITY DEFINER SET search_path = ''/)
 assert.match(sql,/auth\.uid\(\)/)
 assert.match(sql,/publication_status='draft'/)
 assert.match(sql,/p\.is_active=false/)
 assert.match(sql,/PRINTFUL_PRICE_ALREADY_CONFIGURED/)
 assert.match(sql,/INSERT INTO public\.evo_store_variant_prices/)
 assert.match(sql,/false\s+FROM jsonb_array_elements/)
 assert.match(sql,/v_count<>10/)
 assert.match(sql,/GRANT EXECUTE.*\n\s*TO authenticated/)
 assert.match(actions,/PRINTFUL_HOODIE_PRICE_SEED_ENABLED/)
 assert.match(actions,/planPrintfulReconciliation\(/)
 assert.match(actions,/seed_evo_store_printful_draft_prices/)
 assert.match(ui,/do not retry/i)
})
