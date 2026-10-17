import type {KeyObject} from 'node:crypto'
import {verifyStoreCorrelationProofBinding} from './store-correlation-proof-binding.ts'
import type {SignedStoreCorrelationProof} from './store-correlation-signed-proof.ts'
import type {TrustedCorrelationInput,CorrelationResult} from './store-provider-correlation-contract.ts'

/**
 * Closed transaction-admission contract, NOT a database identity boundary.
 * All callbacks must be constructed by a trusted isolated worker.
 * Reauthorization here is necessary but NOT sufficient for a SQL GRANT:
 * actual mutation must independently recheck permissions atomically.
 */
export async function admitStoreCorrelationTransaction(
 proof:SignedStoreCorrelationProof,
 trusted:TrustedCorrelationInput,
 expectedNonce:string,
 trustedPublicKey:KeyObject,
 deps:Readonly<{
  revalidateOperator:()=>Promise<string>
  reloadAttempt:()=>Promise<TrustedCorrelationInput>
  commitAtomically:(input:TrustedCorrelationInput,nonce:string,issuedAtMs:number)=>Promise<CorrelationResult>
 }>,
 now=Date.now(),
):Promise<CorrelationResult>{
 const claims=verifyStoreCorrelationProofBinding(proof,trusted,expectedNonce,trustedPublicKey,now)
 const verifiedOperator=await deps.revalidateOperator()
 if(verifiedOperator!==trusted.operatorId)throw new Error('STORE_TRANSACTION_OPERATOR_REVOKED')
 const latest=await deps.reloadAttempt()
 if(latest.operatorId!==trusted.operatorId||latest.attemptId!==trusted.attemptId
 ||latest.orderId!==trusted.orderId||latest.intentId!==trusted.intentId
 ||latest.receipt!==trusted.receipt||latest.amount!==trusted.amount
 ||latest.currency!==trusted.currency||latest.provider.id!==trusted.provider.id)
  throw new Error('STORE_TRANSACTION_ATTEMPT_CHANGED')
 verifyStoreCorrelationProofBinding(proof,latest,expectedNonce,trustedPublicKey,now)
 const result=await deps.commitAtomically(latest,claims.nonce,claims.iat)
 if(result.payment_ready!==false||result.correlated!==true
 ||result.attempt_id!==trusted.attemptId||result.provider_order_id!==trusted.provider.id)
  throw new Error('STORE_TRANSACTION_RESULT_INVALID')
 return result
}
