import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Printful ingestion ledger records statuses and denies direct client access', async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261009080000_printful_mockup_ingestion_ledger.sql',import.meta.url),'utf8')
 for(const token of ['ENABLE ROW LEVEL SECURITY','REVOKE ALL','UNIQUE (product_id,printful_file_id)','UNIQUE (storage_bucket,storage_path)',"'pending','uploaded','verified','failed'"]) assert.ok(sql.includes(token), token)
 assert.doesNotMatch(sql,/DROP TABLE|DROP SCHEMA|UPDATE public\.evo_store_products/i)
})
test('storage path derivation requires strict product and file IDs',async()=>{
 const source=await readFile(new URL('../src/lib/printful/mockup-storage-path.ts',import.meta.url),'utf8')
 assert.match(source,/createHash\('sha256'\)/)
 assert.match(source,/Number\.isSafeInteger\(printfulFileId\)/)
 assert.match(source,/INVALID_MEDIA_IDENTITY/)
})
