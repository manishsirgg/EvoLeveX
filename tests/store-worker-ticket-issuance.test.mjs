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
