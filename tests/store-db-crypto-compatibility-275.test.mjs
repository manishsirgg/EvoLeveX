import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('database proof gate remains owner-only and deny-all',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261017100000_store_db_proof_verification_gate.sql',import.meta.url),'utf8')
 assert.match(sql,/RETURN false;/)
 assert.match(sql,/REVOKE ALL ON FUNCTION private\.can_execute_evo_store_signed_correlation/)
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role/)
 assert.doesNotMatch(sql,/GRANT EXECUTE/)
})
test('cryptographic compatibility decision prohibits unsupported bypasses',async()=>{
 const doc=await readFile(new URL('../docs/store/database-proof-crypto-compatibility-275.md',import.meta.url),'utf8')
 for(const required of ['pgcrypto','pgsodium','Ed25519','not a native Ed25519 verification','Do **not** install','PostgreSQL 15 and 17','payment_ready=false','No migration']){
  assert.ok(doc.includes(required),required)
 }
})
