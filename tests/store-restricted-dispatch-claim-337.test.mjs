import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('restricted dispatch adapter checks authenticated PostgreSQL principal before parameter-bound claim',async()=>{
 const code=await read('src/lib/store-restricted-dispatch-claim-adapter.ts')
 const identity=code.indexOf("session.query('SELECT current_user AS principal, session_user AS login')")
 const claim=code.indexOf("session.query(\n  'SELECT private.claim_evo_store_provider_dispatch($1::uuid) AS claimed'")
 assert.ok(identity>0&&claim>identity)
 for(const token of ['principal!==expectedLoginRole','login!==expectedLoginRole',
  'STORE_DISPATCH_CLAIM_PRINCIPAL_DENIED','[attempt.attemptId]',
  "typeof result.rows[0].claimed!=='boolean'"])assert.ok(code.includes(token),token)
 assert.doesNotMatch(code,/createRazorpayOrder\(|fetch\(|process\.env\.|createServiceRoleClient|GRANT EXECUTE/)
})
test('real dispatch claim SQL denies public roles and moves only prepared attempts',async()=>{
 const sql=await read('supabase/migrations/20261025131500_store_provider_dispatch_atomic_claim.sql')
 assert.match(sql,/WHERE attempt_id = p_attempt_id AND state = 'prepared'/)
 assert.match(sql,/FROM PUBLIC, anon, authenticated, service_role/)
})
