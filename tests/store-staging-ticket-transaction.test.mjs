import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {stageStoreTicketBoundCorrelation} from '../src/lib/store-staging-ticket-transaction.ts'
import {signStoreCorrelationProof,digestStoreCorrelationEvidence} from '../src/lib/store-correlation-signed-proof.ts'

const {privateKey,publicKey}=generateKeyPairSync('ed25519')
const token='isolated-test-admin-bearer',now=1000000,nonce='abcdef0123456789abcdef0123456789'
const operatorId='a1000000-0000-4000-8000-000000000004'
const trusted={attemptId:'a1000000-0000-4000-8000-000000000001',orderId:'a1000000-0000-4000-8000-000000000002',intentId:'a1000000-0000-4000-8000-000000000003',operatorId,receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD',provider:{id:'order_12345678',receipt:'evs_1234567890abcdef1234567890abcdef',amount:2900,currency:'USD'}}
const proof=signStoreCorrelationProof({v:1,iss:'evo-store-isolated-worker',aud:'evo-store-correlation-worker-staging-v1',operatorId,attemptId:trusted.attemptId,nonce,providerOrderId:trusted.provider.id,evidenceDigest:digestStoreCorrelationEvidence({receipt:trusted.receipt,amount:trusted.amount,currency:trusted.currency,providerOrderId:trusted.provider.id}),iat:now,exp:now+30000},privateKey,now)
function suite(){
 let issues=0,commits=0
 const identity={verifySession:async()=>({id:operatorId,emailConfirmed:true}),hasLiveReconciliationRole:async()=>true}
 const deps={
  validateAttemptForOperator:async(a,o)=>a===trusted.attemptId&&o===operatorId,
  issueTicket:async r=>{assert.match(r.ticket,/^[a-f0-9]{64}$/);issues++},
  reloadAttempt:async()=>trusted,
  consumeTicketAndCommitAtomically:async(ticket,input,n,iat)=>{
   assert.match(ticket,/^[a-f0-9]{64}$/)
   assert.equal(input.attemptId,trusted.attemptId)
   assert.equal(n,nonce);assert.equal(iat,now)
   commits++
   return {correlated:true,created:true,payment_ready:false,attempt_id:trusted.attemptId,provider_order_id:trusted.provider.id}
  },
 }
 const run=(auth=identity,overrides={})=>stageStoreTicketBoundCorrelation(proof,trusted,nonce,publicKey,token,auth,{...deps,...overrides},now)
 return {run,identity,deps,count:()=>({issues,commits})}
}
test('staging authorization composes ticket issue, fresh operator recheck and abstract atomic consume',async()=>{
 const s=suite()
 const result=await s.run()
 assert.equal(result.payment_ready,false)
 assert.deepEqual(s.count(),{issues:1,commits:1})
})
test('rejected attempt prevents ticket issuance or correlation',async()=>{
 const s=suite()
 await assert.rejects(s.run(s.identity,{validateAttemptForOperator:async()=>false}),/ATTEMPT_DENIED/)
 assert.deepEqual(s.count(),{issues:0,commits:0})
})
test('revocation between issuance and transaction admission prevents commit',async()=>{
 const s=suite()
 let eligible=0
 await assert.rejects(s.run({...s.identity,hasLiveReconciliationRole:async()=>++eligible<=2}),/OPERATOR_FORBIDDEN/)
 assert.deepEqual(s.count(),{issues:1,commits:0})
})
test('stale attempt after ticket issuance prevents commit',async()=>{
 const s=suite()
 await assert.rejects(s.run(s.identity,{reloadAttempt:async()=>({...trusted,amount:'30.00'})}),/ATTEMPT_CHANGED/)
 assert.deepEqual(s.count(),{issues:1,commits:0})
})
test('ticket issuer failure prevents commit',async()=>{
 const s=suite()
 await assert.rejects(s.run(s.identity,{issueTicket:async()=>{throw Error('issuer down')}}),/ISSUER_UNAVAILABLE/)
 assert.deepEqual(s.count(),{issues:0,commits:0})
})
