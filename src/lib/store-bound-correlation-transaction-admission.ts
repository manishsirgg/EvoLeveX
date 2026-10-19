import type {KeyObject} from 'node:crypto'
import {admitStoreCorrelationTransaction} from './store-correlation-transaction-admission.ts'
import {revalidateStoreOperatorBinding,type StoreOperatorBinding} from './store-worker-operator-binding.ts'
import type {WorkerIdentityDependencies} from './store-worker-operator-identity.ts'
import type {SignedStoreCorrelationProof} from './store-correlation-signed-proof.ts'
import type {TrustedCorrelationInput,CorrelationResult} from './store-provider-correlation-contract.ts'

/**
 * Application-side staging-only composition. Never a SQL authorization proof.
 * Binding originates from establishStoreOperatorBinding in the same isolated
 * worker, not from a client request. This function is not wired to a route.
 */
export async function admitBoundStoreCorrelationTransaction(
 proof:SignedStoreCorrelationProof,
 trusted:TrustedCorrelationInput,
 expectedNonce:string,
 trustedPublicKey:KeyObject,
 binding:StoreOperatorBinding,
 bearerToken:string,
 identity:WorkerIdentityDependencies,
 deps:Readonly<{
  reloadAttempt:()=>Promise<TrustedCorrelationInput>
  commitAtomically:(input:TrustedCorrelationInput,nonce:string,issuedAtMs:number)=>Promise<CorrelationResult>
 }>,
 now=Date.now(),
):Promise<CorrelationResult>{
 if(binding?.operatorId!==trusted.operatorId)
  throw new Error('STORE_BOUND_TRANSACTION_OPERATOR_MISMATCH')
 return admitStoreCorrelationTransaction(proof,trusted,expectedNonce,trustedPublicKey,{
  revalidateOperator:()=>revalidateStoreOperatorBinding(binding,bearerToken,identity),
  reloadAttempt:deps.reloadAttempt,
  commitAtomically:deps.commitAtomically,
 },now)
}
