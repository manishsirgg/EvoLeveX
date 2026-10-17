import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('PostgreSQL proof gate cannot authorize unsigned or signed caller input',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20261017100000_store_db_proof_verification_gate.sql',import.meta.url),'utf8')
 assert.match(sql,/RETURN false;/)
 assert.match(sql,/REVOKE ALL ON FUNCTION private\.can_execute_evo_store_signed_correlation/)
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role/)
 assert.doesNotMatch(sql,/GRANT EXECUTE/)
})
