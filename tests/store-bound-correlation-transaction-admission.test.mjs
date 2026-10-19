import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {establishStoreOperatorBinding} from '../src/lib/store-worker-operator-binding.ts'
import {admitBoundStoreCorrelationTransaction} from '../src/lib/store-bound-correlation-transaction-admission.ts'
import {signStoreCorrelationProof,digestStoreCorrelationEvidence} from '../src/lib/store-correlation-signed-proof.ts'
const {privateKey,publicKey}=generateKeyPairSync('ed25519')
const token='test-isolated-bearer-token', now=1000000,nonce='abcdef0123456789abcdef0123456789'
const id='a1000000-0000-4000-8000-000000000004'
const trusted={attemptId:'a1000000-0000-4000-8000-000000000001',orderId:'a1000000-0000-4000-8000-000000000002',intentId:'a1000000-0000-4000-8000-000000000003',operatorId:id,receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD',provider:{id:'order_12345678',receipt:'evs_1234567890abcdef1234567890abcdef',amount:2900,currency:'USD'}}
const proof=signStoreCorrelationProof({v:1,iss:'evo-store-isolated-worker',aud:'evo-store-correlation-worker-staging-v1',operatorId:id,attemptId:trusted.attemptId,nonce,providerOrderId:trusted.provider.id,evidenceDigest:digestStoreCorrelationEvidence({receipt:trusted.receipt,amount:trusted.amount,currency:trusted.currency,providerOrderId:trusted.provider.id}),iat:now,exp:now+60000},privateKey,now)
const identity={verifySession:async()=>({id,emailConfirmed:true}),hasLiveReconciliationRole:async()=>true}
function scenario(overrides={}){
 let commits=0
 const callbacks={reloadAttempt:async()=>trusted,commitAtomically:async()=>{commits++;return {correlated:true,created:true,payment_ready:false,attempt_id:trusted.attemptId,provider_order_id:trusted.provider.id}},...overrides}
 return {callbacks,commits:()=>commits}
}
async function execute(binding,bearer,auth,callbacks){
 return admitBoundStoreCorrelationTransaction(proof,trusted,nonce,publicKey,binding,bearer,auth,callbacks,now)
}
test('authorized bound operator revalidates before invoking abstract commit',async()=>{
 const binding=await establishStoreOperatorBinding(token,identity)
 const a=scenario()
 const result=await execute(binding,token,identity,a.callbacks)
 assert.equal(result.payment_ready,false)
 assert.equal(a.commits(),1)
})
test('binding mismatch and replacement bearer fail before commit',async()=>{
 const binding=await establishStoreOperatorBinding(token,identity)
 const a=scenario()
 await assert.rejects(execute({...binding,operatorId:trusted.orderId},token,identity,a.callbacks),/OPERATOR_MISMATCH/)
 await assert.rejects(execute(binding,'substituted-isolated-token',identity,a.callbacks),/TOKEN_CHANGED/)
 assert.equal(a.commits(),0)
})
test('role revocation, identity switch and stale attempt reject before commit',async()=>{
 const binding=await establishStoreOperatorBinding(token,identity)
 const a=scenario()
 await assert.rejects(execute(binding,token,{...identity,hasLiveReconciliationRole:async()=>false},a.callbacks),/OPERATOR_FORBIDDEN/)
 await assert.rejects(execute(binding,token,{...identity,verifySession:async()=>({id:trusted.orderId,emailConfirmed:true})},a.callbacks),/IDENTITY_CHANGED/)
 await assert.rejects(execute(binding,token,identity,scenario({reloadAttempt:async()=>({...trusted,amount:'30.00'})}).callbacks),/ATTEMPT_CHANGED/)
 assert.equal(a.commits(),0)
})
