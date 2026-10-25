import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')
test('staging dispatch uses dedicated connected PG lifecycle, not request-shared session',async()=>{
 const binding=await read('src/lib/store-staging-restricted-dispatch-binding.ts')
 const session=await read('src/lib/store-staging-pg-dispatch-session.ts')
 const claim=await read('src/lib/store-restricted-dispatch-claim-adapter.ts')
 assert.ok(binding.includes('claimForDispatch:attempt=>claimStagingStoreDispatchWithDedicatedPgClient('))
 assert.ok(binding.includes('bindings.restrictedLoginRole,bindings.createRestrictedPgClient'))
 assert.ok(!binding.includes('restrictedSession:RestrictedClaimSession'))
 assert.ok(session.indexOf('await client.connect()')<session.indexOf('claimStoreDispatchWithRestrictedSession(attempt,client,expectedLoginRole)'))
 assert.ok(session.indexOf('claimStoreDispatchWithRestrictedSession(attempt,client,expectedLoginRole)')<session.indexOf('await client.end()'))
 assert.ok(claim.includes('SELECT current_user AS principal, session_user AS login'))
 assert.ok(claim.includes('SELECT private.claim_evo_store_provider_dispatch($1::uuid) AS claimed'))
 assert.doesNotMatch(binding,/process\.env\.|fetch\(|createRazorpayOrder\(|service_role/)
})
