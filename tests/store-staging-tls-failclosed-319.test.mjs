import test from 'node:test'
import assert from 'node:assert/strict'
import {createStagingPgLifecycleFactory} from '../src/lib/store-staging-pg-client-lifecycle.ts'
import {createStagingRestrictedPgTransport} from '../src/lib/store-staging-pg-transport.ts'
import {createStagingStoreRestrictedFunctionRoleLookup} from '../src/lib/store-staging-restricted-function-reader.ts'

const actor='a1000000-0000-4000-8000-000000000002'
const SECRET='postgresql://reader:do-not-disclose@invalid.example'
const failures=[
 ['untrusted certificate','SELF_SIGNED_CERT_IN_CHAIN'],
 ['hostname mismatch','ERR_TLS_CERT_ALTNAME_INVALID'],
 ['expired certificate','CERT_HAS_EXPIRED'],
 ['refused connection','ECONNREFUSED'],
 ['connection timeout','ETIMEDOUT'],
]
for(const [label,code] of failures){
 test('staging reader fails closed for '+label+' and closes client',async()=>{
  const calls=[]
  const transport=createStagingRestrictedPgTransport(createStagingPgLifecycleFactory(settings=>{
   assert.equal(settings.ssl.rejectUnauthorized,true)
   assert.equal(settings.connectionTimeoutMillis,3000)
   return {
    connect:async()=>{calls.push('connect');throw Object.assign(new Error(SECRET),{code})},
    query:async()=>{calls.push('query');return {rows:[{eligible:true}]}},
    end:async()=>{calls.push('end')},
   }
  }))
  const lookup=createStagingStoreRestrictedFunctionRoleLookup(transport)
  await assert.rejects(lookup(actor),e=>{
   assert.equal(e.message,'STORE_RESTRICTED_ROLE_READER_UNAVAILABLE')
   assert.ok(!String(e).includes(SECRET))
   assert.ok(!String(e).includes(code))
   return true
  })
  assert.deepEqual(calls,['connect','end'])
 })
}
