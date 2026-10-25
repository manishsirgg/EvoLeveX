import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('staging role template is manually gated, no-login, restricted to one claim function',async()=>{
 const sql=await readFile(new URL('../docs/store/sql/staging-dispatch-role-provisioning-346.sql',import.meta.url),'utf8')
 for(const token of ["evo.store_staging_provisioning_approved","evo.store_environment","'staging'","NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS","REVOKE ALL ON ALL TABLES IN SCHEMA private","GRANT EXECUTE ON FUNCTION private.claim_evo_store_provider_dispatch(uuid)"])
  assert.ok(sql.includes(token),token)
 assert.doesNotMatch(sql,/\bLOGIN\s+PASSWORD\b|CREATE EXTENSION|\bSUPERUSER\b(?!.*NOT)|GRANT .* ON ALL FUNCTIONS|GRANT .* ON ALL TABLES/)
})
