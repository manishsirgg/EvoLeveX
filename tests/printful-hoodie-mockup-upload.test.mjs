import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('hoodie uploads require independently gated approved gallery and verified fenced writes',async()=>{
 const actions=await readFile(new URL('../src/app/admin/store/printful/actions.ts',import.meta.url),'utf8')
 const gallery=await readFile(new URL('../src/lib/printful/hoodie-mockup-gallery-stage.ts',import.meta.url),'utf8')
 const page=await readFile(new URL('../src/app/admin/store/printful/page.tsx',import.meta.url),'utf8')
 const segment=actions.slice(actions.indexOf('export async function uploadApprovedHoodieMockup'))
 for(const required of ['await requireAdmin()','PRINTFUL_HOODIE_MEDIA_UPLOAD_ENABLED','PRINTFUL_MEDIA_UPLOAD_ENABLED','reserve_evo_store_printful_mockup','claim_evo_store_printful_mockup_upload','upsert:false','sha256','complete_evo_store_printful_mockup','p_claim_token:token','RECONCILIATION_REQUIRED']) assert.ok(segment.includes(required),required)
 assert.match(gallery,/1085999540/)
 assert.match(gallery,/1085999541/)
 assert.match(gallery,/planPrintfulReconciliation/)
 assert.match(page,/HoodieMockupUploadControl authorized=/)
})
