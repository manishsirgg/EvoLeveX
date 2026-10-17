import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {signStoreCorrelationProof,digestStoreCorrelationEvidence} from '../src/lib/store-correlation-signed-proof.ts'
import {verifyStoreCorrelationProofBinding} from '../src/lib/store-correlation-proof-binding.ts'
const {privateKey,publicKey}=generateKeyPairSync('ed25519')
const input={attemptId:'a1000000-0000-4000-8000-000000000001',orderId:'a1000000-0000-4000-8000-000000000002',intentId:'a1000000-0000-4000-8000-000000000003',operatorId:'a1000000-0000-4000-8000-000000000004',receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD',provider:{id:'order_12345678',receipt:'evs_1234567890abcdef1234567890abcdef',amount:2900,currency:'USD'}}
const nonce='abcdef0123456789abcdef0123456789',now=1000000
const claims={v:1,iss:'evo-store-isolated-worker',aud:'evo-store-correlation-worker-staging-v1',operatorId:input.operatorId,attemptId:input.attemptId,nonce,providerOrderId:input.provider.id,evidenceDigest:digestStoreCorrelationEvidence({receipt:input.receipt,amount:input.amount,currency:input.currency,providerOrderId:input.provider.id}),iat:now,exp:now+60000}
const proof=()=>signStoreCorrelationProof(claims,privateKey,now)
test('valid proof binds independent attempt, operator, nonce and provider',()=>{
 assert.deepEqual(verifyStoreCorrelationProofBinding(proof(),input,nonce,publicKey,now),claims)
})
test('wrong operator, attempt, nonce and provider IDs fail',()=>{
 for(const [trusted,n] of [[{...input,operatorId:input.orderId},nonce],[{...input,attemptId:input.orderId},nonce],[input,'ffffffffffffffffffffffffffffffff'],[{...input,provider:{...input.provider,id:'order_87654321'}},nonce]]){
  assert.throws(()=>verifyStoreCorrelationProofBinding(proof(),trusted,n,publicKey,now),/IDENTITY_MISMATCH/)
 }
})
test('evidence drift, forged signature, expired proof fail closed',()=>{
 assert.throws(()=>verifyStoreCorrelationProofBinding(proof(),{...input,amount:'30.00'},nonce,publicKey,now),/PROVIDER_MISMATCH/)
 assert.throws(()=>verifyStoreCorrelationProofBinding(proof(),{...input,receipt:'evs_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',provider:{...input.provider,receipt:'evs_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}},nonce,publicKey,now),/EVIDENCE_MISMATCH/)
 const wrong=generateKeyPairSync('ed25519')
 assert.throws(()=>verifyStoreCorrelationProofBinding(proof(),input,nonce,wrong.publicKey,now),/SIGNATURE_INVALID/)
 assert.throws(()=>verifyStoreCorrelationProofBinding(proof(),input,nonce,publicKey,now+60000),/CLAIMS_INVALID/)
})
