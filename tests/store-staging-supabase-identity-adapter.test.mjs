import test from 'node:test'
import assert from 'node:assert/strict'
import {createStagingStoreSupabaseIdentity} from '../src/lib/store-staging-supabase-identity-adapter.ts'
import {issueBoundStoreOperatorTicket} from '../src/lib/store-worker-ticket-issuance.ts'

const admin='a1000000-0000-4000-8000-000000000001'
const outsider='a1000000-0000-4000-8000-000000000006'
const attempt='a1000000-0000-4000-8000-000000000002'
const token='verified-server-token-not-caller-id'
const auth=(id=admin,confirmed=true)=>({
 auth:{getUser:async(received)=>{
  assert.equal(received,token)
  return {data:{user:{id,email_confirmed_at:confirmed?'2026-10-19T00:00:00Z':null}},error:null}
 }},
})
test('staging adapter binds ticket to live getUser identity and current role',async()=>{
 const seen=[],identity=createStagingStoreSupabaseIdentity(auth(),async id=>id===admin)
 const issued=await issueBoundStoreOperatorTicket(token,attempt,identity,{
  validateAttemptForOperator:async(a,id)=>a===attempt&&id===admin,
  issueTicket:async request=>{seen.push(request)},
 },1000000)
 assert.equal(issued.operatorId,admin)
 assert.equal(seen.length,1)
 assert.equal(seen[0].operatorId,admin)
})
test('different verified user cannot impersonate administrator',async()=>{
 let writes=0
 const identity=createStagingStoreSupabaseIdentity(auth(outsider),async id=>id===admin)
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,identity,{
  validateAttemptForOperator:async()=>true,issueTicket:async()=>{writes++},
 }),/OPERATOR_FORBIDDEN/)
 assert.equal(writes,0)
})
test('unconfirmed email, missing session and Auth errors prevent issuance',async()=>{
 let writes=0
 for(const source of [
  auth(admin,false),
  {auth:{getUser:async()=>({data:{user:null},error:null})}},
  {auth:{getUser:async()=>({data:{user:null},error:new Error('unauthorized')})}},
  {auth:{getUser:async()=>{throw Error('offline')}}},
 ]){
  await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,
   createStagingStoreSupabaseIdentity(source,async()=>true),{
    validateAttemptForOperator:async()=>true,issueTicket:async()=>{writes++},
   }),/SESSION_UNVERIFIED/)
 }
 assert.equal(writes,0)
})
test('live role lookup revocation and outages fail closed',async()=>{
 let calls=0,writes=0
 const identity=createStagingStoreSupabaseIdentity(auth(),async()=>++calls===1)
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,identity,{
  validateAttemptForOperator:async()=>true,issueTicket:async()=>{writes++},
 }),/OPERATOR_FORBIDDEN/)
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,
  createStagingStoreSupabaseIdentity(auth(),async()=>{throw Error('database offline')}),{
   validateAttemptForOperator:async()=>true,issueTicket:async()=>{writes++},
  }),/AUTHORIZATION_UNAVAILABLE/)
 assert.equal(writes,0)
})
