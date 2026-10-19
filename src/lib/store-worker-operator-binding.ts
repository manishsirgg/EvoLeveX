import {createHash,timingSafeEqual} from 'node:crypto'
import {authenticateStoreWorkerOperator,type WorkerIdentityDependencies} from './store-worker-operator-identity.ts'

/**
 * Staging-only operator-to-worker session binding, NOT a SQL admission grant.
 * A caller-supplied operator ID is never an authentication source.
 * Hold the bearer secret only inside the isolated worker; this binding stores
 * only its one-way fingerprint and verified operator identity.
 */
export type StoreOperatorBinding=Readonly<{operatorId:string;tokenFingerprint:string}>
function fingerprint(token:string):string{
 return createHash('sha256').update(token,'utf8').digest('hex')
}
export async function establishStoreOperatorBinding(
 bearerToken:string,deps:WorkerIdentityDependencies,
):Promise<StoreOperatorBinding>{
 const operatorId=await authenticateStoreWorkerOperator(bearerToken,deps)
 return Object.freeze({operatorId,tokenFingerprint:fingerprint(bearerToken)})
}
export async function revalidateStoreOperatorBinding(
 existing:StoreOperatorBinding,bearerToken:string,deps:WorkerIdentityDependencies,
):Promise<string>{
 // Revalidate the very same credential and its current identity/role.
 if(!existing||typeof existing.operatorId!=='string'
  ||typeof existing.tokenFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(existing.tokenFingerprint)
  ||typeof bearerToken!=='string')throw new Error('STORE_OPERATOR_BINDING_INVALID')
 const current=fingerprint(bearerToken)
 if(!timingSafeEqual(Buffer.from(current,'hex'),Buffer.from(existing.tokenFingerprint,'hex')))
  throw new Error('STORE_OPERATOR_BINDING_TOKEN_CHANGED')
 const operatorId=await authenticateStoreWorkerOperator(bearerToken,deps)
 if(operatorId!==existing.operatorId)throw new Error('STORE_OPERATOR_BINDING_IDENTITY_CHANGED')
 return operatorId
}
