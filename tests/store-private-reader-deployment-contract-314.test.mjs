import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('stable private reader plan preserves explicit non-deployment security gates',async()=>{
 const doc=await readFile(new URL('../docs/store/private-reader-deployment-contract-314.md',import.meta.url),'utf8')
 const reader=await readFile(new URL('../src/lib/store-staging-restricted-function-reader.ts',import.meta.url),'utf8')
 assert.match(doc,/private\.evo_store_operator_eligible_for_reconciliation/)
 for(const constraint of [
  'NOLOGIN','NOBYPASSRLS','SECURITY DEFINER',"search_path=''",
  'anon, authenticated, service_role','getUser','TLS','rollback',
  'Razorpay Orders POST/capture','Printful fulfillment',
 ]) assert.ok(doc.includes(constraint),'missing boundary: '+constraint)
 assert.ok(reader.includes('test_stage_reader_309.eligible($1::uuid)'),
  'live adapter must remain disconnected from proposed name')
 assert.ok(!reader.includes('private.evo_store_operator_eligible_for_reconciliation'),
  'do not silently enable private contract before DB grants and TLS review')
})
