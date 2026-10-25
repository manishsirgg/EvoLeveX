import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
test('dispatch claim uses one connected client for current_user and atomic claim',async()=>{
 const code=await read('src/lib/store-staging-pg-dispatch-session.ts')
 const adapter=await read('src/lib/store-restricted-dispatch-claim-adapter.ts')
 assert.ok(code.includes('await client.connect()'))
 assert.ok(code.includes('claimStoreDispatchWithRestrictedSession(attempt,client,expectedLoginRole)'))
 assert.ok(code.includes('await client.end()'))
 assert.ok(code.indexOf('await client.connect()')<code.indexOf('claimStoreDispatchWithRestrictedSession(attempt,client,expectedLoginRole)'))
 assert.ok(adapter.includes('SELECT current_user AS principal, session_user AS login'))
 assert.ok(adapter.includes('SELECT private.claim_evo_store_provider_dispatch($1::uuid) AS claimed'))
 assert.doesNotMatch(code,/process\.env\.|fetch\(|createRazorpayOrder|service_role|GRANT EXECUTE/)
})
test('staging PG claim closes the connection and fails shut when close fails',async()=>{
 const code=await read('src/lib/store-staging-pg-dispatch-session.ts')
 assert.ok(code.includes("throw new Error('STORE_DISPATCH_PG_CLOSE_FAILED')"))
 assert.ok(code.includes('if(operationError)throw operationError'))
})
