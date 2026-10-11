import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = new URL('../supabase/migrations/20261011030000_printful_storage_rls_hardening.sql',import.meta.url)

test('Storage RLS for mapped products is restrictive; ordinary image policies remain intact',async()=>{
 const sql=await readFile(migration,'utf8')
 for(const name of ['evo_printful_storage_claim_insert_guard','evo_printful_storage_no_direct_update_guard','evo_printful_storage_no_direct_delete_guard'])
   assert.match(sql,new RegExp('CREATE POLICY '+name+'\\s+ON storage\\.objects AS RESTRICTIVE'))
 assert.match(sql,/CREATE POLICY evo_printful_storage_claimed_pending_read/)
 assert.doesNotMatch(sql,/DROP POLICY|ALTER POLICY|ALTER TABLE storage\.objects DISABLE ROW LEVEL SECURITY/)
})

test('Mapped uploads require claim ownership; token remains a completion-only secret',async()=>{
 const sql=await readFile(migration,'utf8')
 for(const required of ['c.claimed_by=auth.uid()',"l.status='pending'","r.code IN ('admin','super_admin')","mapped_image.is_active","p_operation <> 'insert'"])
   assert.ok(sql.includes(required),required)
 assert.match(sql,/private\.evo_store_printful_pending_read_permitted/)
 assert.doesNotMatch(sql,/claim_token\s*=\s*auth\.uid\(\)/)
})
