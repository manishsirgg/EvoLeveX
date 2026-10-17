import {timingSafeEqual,type KeyObject} from 'node:crypto'
import {digestStoreCorrelationEvidence,verifyStoreCorrelationProof} from './store-correlation-signed-proof.ts'
import type {SignedStoreCorrelationProof,StoreCorrelationProofClaims} from './store-correlation-signed-proof.ts'
import {toRazorpaySubunits} from './razorpay-money.ts'
import type {TrustedCorrelationInput} from './store-provider-correlation-contract.ts'

/**
 * Pure evidence-binding check. The expected operator and trusted input must be
 * independently established by the isolated worker; never taken from proof JSON.
 * This module does not consume a nonce or provide database execution authority.
 */
export function verifyStoreCorrelationProofBinding(
 proof:SignedStoreCorrelationProof,
 trusted:TrustedCorrelationInput,
 expectedNonce:string,
 publicKey:KeyObject,
 now=Date.now(),
):StoreCorrelationProofClaims{
 const claims=verifyStoreCorrelationProof(proof,publicKey,now)
 if(claims.operatorId!==trusted.operatorId||claims.attemptId!==trusted.attemptId
   ||claims.nonce!==expectedNonce||claims.providerOrderId!==trusted.provider.id)
  throw new Error('STORE_PROOF_BINDING_IDENTITY_MISMATCH')
 if(trusted.provider.receipt!==trusted.receipt
   ||trusted.provider.currency!==trusted.currency
   ||trusted.provider.amount!==toRazorpaySubunits(trusted.amount,trusted.currency))
  throw new Error('STORE_PROOF_BINDING_PROVIDER_MISMATCH')
 const expected=digestStoreCorrelationEvidence({
  receipt:trusted.receipt,amount:trusted.amount,currency:trusted.currency,
  providerOrderId:trusted.provider.id,
 })
 const actual=Buffer.from(claims.evidenceDigest,'hex')
 const comparison=Buffer.from(expected,'hex')
 if(actual.length!==comparison.length||!timingSafeEqual(actual,comparison))
  throw new Error('STORE_PROOF_BINDING_EVIDENCE_MISMATCH')
 return claims
}
