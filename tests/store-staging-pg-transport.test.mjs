import test from 'node:test'
import assert from 'node:assert/strict'
import {createStagingRestrictedPgTransport} from '../src/lib/store-staging-pg-transport.ts'
import {createStagingStoreRestrictedFunctionRoleLookup,STORE_RESTRICTED_ROLE_FUNCTION_SQL} from '../src/lib/store-staging-restricted-function-reader.ts'
const admin='a1000000-0000-4000-8000-000000000001'
test('restricts fixed SQL, binds ID and requires TLS verification/timeouts',async()=>{
 const requests=[]
 const transport=createStagingRestrictedPgTransport(async settings=>{
  assert.equal(settings.ssl.rejectUnauthorized,true)
  assert.equal(settings.connectionTimeoutMillis,3000)
  assert.equal(settings.query_timeout,3000)
  assert.equal(settings.statement_timeout,3000)
  return {query:async(sql,values)=>{requests.push([sql,values]);return {rows:[{eligible:true}]}}}
 })
 const lookup=createStagingStoreRestrictedFunctionRoleLookup(transport)
 assert.equal(await lookup(admin),true)
 assert.deepEqual(requests,[[STORE_RESTRICTED_ROLE_FUNCTION_SQL,[admin]]])
 await assert.rejects(transport('SELECT * FROM public.payments',[admin]),/QUERY_DENIED/)
 assert.equal(requests.length,1)
})
test('connection and query errors fail closed',async()=>{
 const connectFail=createStagingRestrictedPgTransport(async()=>{throw Error('connect offline')})
 const executeFail=createStagingRestrictedPgTransport(async()=>({query:async()=>{throw Error('query offline')}}))
 await assert.rejects(connectFail(STORE_RESTRICTED_ROLE_FUNCTION_SQL,[admin]),/CONNECTION_UNAVAILABLE/)
 await assert.rejects(executeFail(STORE_RESTRICTED_ROLE_FUNCTION_SQL,[admin]),/CONNECTION_UNAVAILABLE/)
 assert.equal(await createStagingStoreRestrictedFunctionRoleLookup(async()=>({rows:[{eligible:false}]}))(admin),false)
})
