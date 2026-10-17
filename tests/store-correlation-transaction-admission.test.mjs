import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {admitStoreCorrelationTransaction} from '../src/lib/store-correlation-transaction-admission.ts'
import {signStoreCorrelationProof,digestStoreCorrelationEvidence} from '../src/lib/store-correlation-signed-proof.ts'
const {privateKey,publicKey}=generateKeyPairSync('ed25519')
const nonce='abcdef0123456789abcdef0123456789',now=1000000
const trusted={attemptId:'a1000000-0000-4000-8000-000000000001',orderId:'a1000000-0000-4000-8000-000000000002',intentId:'a1000000-0000-4000-8000-000000000003',operatorId:'a1000000-0000-4000-8000-000000000004',receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD',provider:{id:'order_12345678',receipt:'evs_1234567890abcdef1234567890abcdef',amount:2900,currency:'USD'}}
const claims={v:1,iss:'evo-store-isolated-worker',aud:'evo-store-correlation-worker-staging-v1',operatorId:trusted.operatorId,attemptId:trusted.attemptId,nonce,providerOrderId:trusted.provider.id,evidenceDigest:digestStoreCorrelationEvidence({receipt:trusted.receipt,amount:trusted.amount,currency:trusted.currency,providerOrderId:trusted.provider.id}),iat:now,exp:now+60000}
const proof=signStoreCorrelationProof(claims,privateKey,now)
function deps(overrides={}){
 let committed=0
 return {dependencies:{
 revalidateOperator:async()=>trusted.operatorId,
 reloadAttempt:async()=>trusted,
 commitAtomically:async()=>{committed++;return {correlated:true,created:true,payment_ready:false,attempt_id:trusted.attemptId,provider_order_id:trusted.provider.id}},
 ...overrides},count:()=>committed}
}
test('accepts fresh verified proof with operator and attempt recheck',async()=>{
 const a=deps()
 const result=await admitStoreCorrelationTransaction(proof,trusted,nonce,publicKey,a.dependencies,now)
 assert.equal(result.payment_ready,false)
 assert.equal(a.count(),1)
})
test('revoked operator and modified attempt reject before transaction',async()=>{
 const revoked=deps({revalidateOperator:async()=>trusted.orderId})
 await assert.rejects(admitStoreCorrelationTransaction(proof,trusted,nonce,publicKey,revoked.dependencies,now),/REVOKED/)
 assert.equal(revoked.count(),0)
 const changed=deps({reloadAttempt:async()=>({...trusted,amount:'30.00'})})
 await assert.rejects(admitStoreCorrelationTransaction(proof,trusted,nonce,publicKey,changed.dependencies,now),/CHANGED/)
 assert.equal(changed.count(),0)
})
test('expired proof rejects before any execution',async()=>{
 const a=deps()
 await assert.rejects(admitStoreCorrelationTransaction(proof,trusted,nonce,publicKey,a.dependencies,now+60000),/CLAIMS_INVALID/)
 assert.equal(a.count(),0)
})
