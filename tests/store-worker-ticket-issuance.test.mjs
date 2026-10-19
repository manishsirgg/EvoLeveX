import test from 'node:test'
import assert from 'node:assert/strict'
import {issueBoundStoreOperatorTicket} from '../src/lib/store-worker-ticket-issuance.ts'
const id='a1000000-0000-4000-8000-000000000001',attempt='a1000000-0000-4000-8000-000000000002',token='isolated-bearer-token-test'
const identity={verifySession:async()=>({id,emailConfirmed:true}),hasLiveReconciliationRole:async()=>true}
test('issues short-lived random ticket only after authenticated operator, current role and attempt authorization',async()=>{
 const issued=[]
 const deps={validateAttemptForOperator:async(a,o)=>a===attempt&&o===id,issueTicket:async ticket=>issued.push(ticket)}
 const a=await issueBoundStoreOperatorTicket(token,attempt,identity,deps,1000000)
 const b=await issueBoundStoreOperatorTicket(token,attempt,identity,deps,1000000)
 assert.equal(issued.length,2)
 assert.equal(a.operatorId,id)
 assert.equal(a.attemptId,attempt)
 assert.match(a.ticket,/^[0-9a-f]{64}$/)
 assert.notEqual(a.ticket,b.ticket)
 assert.equal(a.expiresAt,new Date(1030000).toISOString())
 assert.equal(a.binding.operatorId,id)
})
test('denies unauthorized attempt and revoked role before issuance',async()=>{
 let writes=0
 const deps={validateAttemptForOperator:async()=>false,issueTicket:async()=>{writes++}}
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,identity,deps),/ATTEMPT_DENIED/)
 const revoking={...identity,hasLiveReconciliationRole:(()=>{let calls=0;return async()=>++calls===1})()}
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,revoking,{...deps,validateAttemptForOperator:async()=>true}),/OPERATOR_FORBIDDEN/)
 assert.equal(writes,0)
})
test('denies malformed request, unverified operator and failed issuer',async()=>{
 const deps={validateAttemptForOperator:async()=>true,issueTicket:async()=>{throw Error('unavailable')}}
 await assert.rejects(issueBoundStoreOperatorTicket(token,'invalid',identity,deps),/REQUEST_INVALID/)
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,{...identity,verifySession:async()=>null},deps),/SESSION_UNVERIFIED/)
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,identity,deps),/ISSUER_UNAVAILABLE/)
})

test('rejects operator impersonation: ticket identity comes from verified bearer, not proposed actor',async()=>{
 const impostor='a1000000-0000-4000-8000-000000000006'
 let writes=0
 const verified={...identity,verifySession:async()=>({id:impostor,emailConfirmed:true})}
 const deps={
  validateAttemptForOperator:async(a,o)=>a===attempt&&o===id,
  issueTicket:async()=>{writes++},
 }
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,verified,deps,1000000),/ATTEMPT_DENIED/)
 assert.equal(writes,0)
})
test('fails closed on role revocation during second authentication check',async()=>{
 let writes=0,roleChecks=0
 const revoked={...identity,hasLiveReconciliationRole:async()=>++roleChecks===1}
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,revoked,{
  validateAttemptForOperator:async()=>true,
  issueTicket:async()=>{writes++},
 },1000000),/OPERATOR_FORBIDDEN/)
 assert.equal(roleChecks,2)
 assert.equal(writes,0)
})
test('fails closed on identity change between initial verification and ticket issuance',async()=>{
 const impostor='a1000000-0000-4000-8000-000000000006'
 let verifications=0,writes=0
 const swapped={...identity,verifySession:async()=>({id:++verifications===1?id:impostor,emailConfirmed:true})}
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,swapped,{
  validateAttemptForOperator:async()=>true,
  issueTicket:async()=>{writes++},
 },1000000),/OPERATOR_IDENTITY_CHANGED|OPERATOR_BINDING|OPERATOR_FORBIDDEN/)
 assert.equal(writes,0)
})
test('fails closed on identity or attempt validation backend failure',async()=>{
 let writes=0
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,{
  ...identity,verifySession:async()=>{throw Error('auth unavailable')},
 },{validateAttemptForOperator:async()=>true,issueTicket:async()=>{writes++}}),/SESSION_UNVERIFIED/)
 await assert.rejects(issueBoundStoreOperatorTicket(token,attempt,identity,{
  validateAttemptForOperator:async()=>{throw Error('database unavailable')},
  issueTicket:async()=>{writes++},
 }),/ATTEMPT_UNAVAILABLE/)
 assert.equal(writes,0)
})
