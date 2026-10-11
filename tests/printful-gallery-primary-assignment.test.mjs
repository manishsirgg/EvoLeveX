import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = new URL('../supabase/migrations/20261011040000_printful_gallery_primary_assignment.sql',import.meta.url)

test('Gallery primary assignment is opt-in, authenticated admin-only and never publishes a product',async()=>{
 const sql=await readFile(migration,'utf8')
 assert.match(sql,/CREATE FUNCTION public\.finalize_evo_store_printful_gallery\(\)/)
 assert.match(sql,/SECURITY DEFINER SET search_path = ''/)
 assert.match(sql,/auth\.uid\(\)/)
 assert.match(sql,/r\.code IN \('admin','super_admin'\)/)
 assert.match(sql,/publication_status='draft'/)
 assert.match(sql,/p\.is_active=false/)
 assert.match(sql,/total_variants <> 18 OR active_variants <> 0/)
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.finalize_evo_store_printful_gallery\(\)\s+TO authenticated/)
 assert.doesNotMatch(sql,/UPDATE public\.evo_store_products|UPDATE public\.evo_store_variants|INSERT INTO storage\.objects/)
 const afterFunction=sql.slice(sql.indexOf('REVOKE ALL'))
 assert.doesNotMatch(afterFunction,/SELECT public\.finalize_evo_store_printful_gallery\(/)
})

test('Only three verified Storage-backed approved images qualify; Black gets sole primary',async()=>{
 const sql=await readFile(migration,'utf8')
 for(const id of ['1082848720','1082848721','1082848722']) assert.ok(sql.includes(id))
 assert.match(sql,/total_images <> 3/)
 assert.match(sql,/ready_images <> 3/)
 assert.match(sql,/l\.status='verified'/)
 assert.match(sql,/i\.is_active=true/)
 assert.match(sql,/storage\.objects/)
 assert.match(sql,/count\(\*\).*is_primary/)
 assert.match(sql,/SET is_primary=/)
 assert.doesNotMatch(sql,/SET\s+sort_order\s*=/)
})
