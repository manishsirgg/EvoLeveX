import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {digestStoreCorrelationEvidence,signStoreCorrelationProof,verifyStoreCorrelationProof} from '../src/lib/store-correlation-signed-proof.ts'
const {privateKey,publicKey}=generateKeyPairSync('ed25519')
const now=1000000
const claims={v:1,iss:'evo-store-isolated-worker',aud:'evo-store-correlation-worker-staging-v1',operatorId:'a1000000-0000-4000-8000-000000000001',attemptId:'a1000000-0000-4000-8000-000000000002',nonce:'abcdef0123456789abcdef0123456789',providerOrderId:'order_12345678',evidenceDigest:digestStoreCorrelationEvidence({receipt:'evs_1234567890abcdef1234567890abcdef',amount:'29.00',currency:'USD',providerOrderId:'order_12345678'}),iat:now,exp:now+60000}
test('valid Ed25519 signature binds evidence and identities',()=>{
 const proof=signStoreCorrelationProof(claims,privateKey,now)
 assert.deepEqual(verifyStoreCorrelationProof(proof,publicKey,now),claims)
})
test('tampering, bad key and expiration fail closed',()=>{
 const proof=signStoreCorrelationProof(claims,privateKey,now)
 const other=generateKeyPairSync('ed25519')
 assert.throws(()=>verifyStoreCorrelationProof(proof,other.publicKey,now),/SIGNATURE_INVALID/)
 assert.throws(()=>verifyStoreCorrelationProof(proof,publicKey,now+60000),/CLAIMS_INVALID/)
 assert.throws(()=>verifyStoreCorrelationProof({...proof,payload:proof.payload.slice(0,-1)+'A'},publicKey,now),/STORE_PROOF_/)
 assert.throws(()=>signStoreCorrelationProof({...claims,aud:'not-intended'},privateKey,now),/CLAIMS_INVALID/)
})
test('evidence digest detects amount/receipt/currency changes',()=>{
 const baseline=digestStoreCorrelationEvidence({receipt:'a',amount:'1.00',currency:'USD',providerOrderId:'order_12345678'})
 for(const data of [{receipt:'b',amount:'1.00',currency:'USD',providerOrderId:'order_12345678'},{receipt:'a',amount:'2.00',currency:'USD',providerOrderId:'order_12345678'},{receipt:'a',amount:'1.00',currency:'INR',providerOrderId:'order_12345678'}])
  assert.notEqual(digestStoreCorrelationEvidence(data),baseline)
})
