import test from 'node:test'
import assert from 'node:assert/strict'
import {createStagingStoreRestrictedFunctionRoleLookup,STORE_RESTRICTED_ROLE_FUNCTION_SQL} from '../src/lib/store-staging-restricted-function-reader.ts'
import {createStagingStoreSupabaseIdentity} from '../src/lib/store-staging-supabase-identity-adapter.ts'
import {issueBoundStoreOperatorTicket} from '../src/lib/store-worker-ticket-issuance.ts'

const admin='a1000000-0000-4000-8000-000000000001'
const attempt='a1000000-0000-4000-8000-000000000002'
const token='staging-restricted-function-bearer'
test('uses only fixed parameterized function SQL, rejects invalid operator IDs',async()=>{
 const calls=[]
 const lookup=createStagingStoreRestrictedFunctionRoleLookup(async(sql,params)=>{
  calls.push({sql,params});return {rows:[{eligible:true}]}
 })
 assert.equal(await lookup(admin),true)
 assert.equal(calls.length,1)
 assert.equal(calls[0].sql,STORE_RESTRICTED_ROLE_FUNCTION_SQL)
 assert.deepEqual(calls[0].params,[admin])
 assert.match(calls[0].sql,/test_stage_reader_309\.eligible\(\$1::uuid\)/)
 assert.equal(await lookup("'; DROP TABLE public.roles;--"),false)
 assert.equal(calls.length,1)
})
test('function reader fails closed on missing, ambiguous, nonboolean or failed results',async()=>{
 for(const rows of [[],[{eligible:true},{eligible:true}],[{eligible:1}],[{eligible:'t'}],[{eligible:false}]]){
  assert.equal(await createStagingStoreRestrictedFunctionRoleLookup(async()=>({rows}))(admin),false)
 }
 await assert.rejects(createStagingStoreRestrictedFunctionRoleLookup(async()=>{throw Error('connection lost')})(admin),/READER_UNAVAILABLE/)
})
test('getUser identity and restricted function reader revalidate role before ticket writer',async()=>{
 let checks=0,writes=0
 const reader=createStagingStoreRestrictedFunctionRoleLookup(async()=>{
  checks++
  return {rows:[{eligible:checks===1}]}
 })
 const identity=createStagingStoreSupabaseIdentity({
  auth:{getUser:async()=>({data:{user:{id:admin,email_confirmed_at:'2026-10-19T00:00:00Z'}},error:null})},
 },reader)
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,identity,{
  validateAttemptForOperator:async()=>true,
  issueTicket:async()=>{writes++},
 }),/OPERATOR_FORBIDDEN/)
 assert.equal(checks,2)
 assert.equal(writes,0)
})
