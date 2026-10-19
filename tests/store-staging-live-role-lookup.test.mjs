import test from 'node:test'
import assert from 'node:assert/strict'
import {createStagingStoreLiveRoleLookup,STORE_ADMIN_ELIGIBILITY_SQL} from '../src/lib/store-staging-live-role-lookup.ts'
import {createStagingStoreSupabaseIdentity} from '../src/lib/store-staging-supabase-identity-adapter.ts'
import {issueBoundStoreOperatorTicket} from '../src/lib/store-worker-ticket-issuance.ts'

const admin='a1000000-0000-4000-8000-000000000001'
const outsider='a1000000-0000-4000-8000-000000000006'
const attempt='a1000000-0000-4000-8000-000000000002'
const bearer='staging-live-role-bearer-token'
test('queries real Store role tables with SQL-bound UUID parameter only',async()=>{
 const calls=[]
 const lookup=createStagingStoreLiveRoleLookup(async(sql,params)=>{
  calls.push({sql,params})
  return {rows:[{eligible:true}]}
 })
 assert.equal(await lookup(admin),true)
 assert.deepEqual(calls[0].params,[admin])
 assert.equal(calls[0].sql,STORE_ADMIN_ELIGIBILITY_SQL)
 assert.match(calls[0].sql,/public\.user_roles/)
 assert.match(calls[0].sql,/public\.roles/)
 assert.match(calls[0].sql,/\$1::uuid/)
 assert.equal(await lookup("x' OR true --"),false)
 assert.equal(calls.length,1)
})
test('rejects false, ambiguous and malformed lookup results',async()=>{
 for(const rows of [[{eligible:false}],[],[{eligible:true},{eligible:true}],[{eligible:'true'}]]){
  const lookup=createStagingStoreLiveRoleLookup(async()=>({rows}))
  assert.equal(await lookup(admin),false)
 }
})
test('role revocation is observed on second live lookup, before ticket write',async()=>{
 let authorized=true,writes=0,calls=0
 const role=createStagingStoreLiveRoleLookup(async(_sql,params)=>{
  assert.deepEqual(params,[admin])
  calls++
  const answer=authorized
  authorized=false
  return {rows:[{eligible:answer}]}
 })
 const identity=createStagingStoreSupabaseIdentity({
  auth:{getUser:async()=>({data:{user:{id:admin,email_confirmed_at:'2026-10-19T00:00:00Z'}},error:null})},
 },role)
 await assert.rejects(issueBoundStoreOperatorTicket(bearer,attempt,identity,{
  validateAttemptForOperator:async()=>true,
  issueTicket:async()=>{writes++},
 }),/OPERATOR_FORBIDDEN/)
 assert.equal(calls,2)
 assert.equal(writes,0)
})
test('outsider never inherits admin permissions; database outage aborts',async()=>{
 const role=createStagingStoreLiveRoleLookup(async(_sql,[id])=>({rows:[{eligible:id===admin}]}))
 const identity=createStagingStoreSupabaseIdentity({
  auth:{getUser:async()=>({data:{user:{id:outsider,email_confirmed_at:'2026-10-19T00:00:00Z'}},error:null})},
 },role)
 let writes=0
 await assert.rejects(issueBoundStoreOperatorTicket(bearer,attempt,identity,{
  validateAttemptForOperator:async()=>true,issueTicket:async()=>{writes++},
 }),/OPERATOR_FORBIDDEN/)
 const unavailable=createStagingStoreLiveRoleLookup(async()=>{throw Error('database offline')})
 await assert.rejects(unavailable(admin),/LOOKUP_UNAVAILABLE/)
 assert.equal(writes,0)
})
