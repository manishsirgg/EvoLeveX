import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('identity handoff prohibits spoofable claim-based owner execution',async()=>{
 const text=await readFile(new URL('../docs/store/verified-worker-database-identity-handoff.md',import.meta.url),'utf8')
 for(const phrase of ['request.jwt.claim.sub','unforgeable token','nonce','recheck the operator role','payment_ready:false','no database grants']){
  assert.ok(text.toLowerCase().includes(phrase.toLowerCase()),phrase)
 }
})
test('existing atomic SQL remains restricted to owner, not app roles',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261017080000_store_atomic_correlation_protocol.sql',import.meta.url),'utf8')
 assert.match(sql,/REVOKE ALL ON FUNCTION private\.execute_evo_store_correlation_atomically/)
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role/)
 assert.doesNotMatch(sql,/GRANT EXECUTE/)
})
