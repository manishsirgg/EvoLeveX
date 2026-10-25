import 'server-only'
import {executeAdmittedStagingStoreDispatch} from './store-staging-admitted-dispatch'
import {claimStoreDispatchWithRestrictedSession,type RestrictedClaimSession} from './store-restricted-dispatch-claim-adapter'
import type {TrustedStoreDispatchAttempt,StoreDispatchDependencies,StoreDispatchResult} from './store-provider-order-dispatch-core'
import type {WorkerAdmissionConfig} from './store-worker-admission'

type Bindings=Readonly<{
 verifyOperator:(token:string)=>Promise<string>
 loadAttempt:(attemptId:string,operatorId:string)=>Promise<TrustedStoreDispatchAttempt>
 restrictedSession:RestrictedClaimSession
 restrictedLoginRole:string
 // Real provider dispatch, GET and correlation capabilities remain external and disabled.
 provider:Pick<StoreDispatchDependencies,'createProviderOrder'|'readProviderOrder'|'correlateVerified'>
}>

/** Restricted claim integration for an isolated staging worker. This module does
 * not create a PG connection, provision grants, start a worker or issue HTTP requests.
 * Only the external isolated staging runtime can supply verified capabilities.
 */
export async function executeStagingStoreDispatchWithRestrictedClaim(
 config:WorkerAdmissionConfig,
 operatorToken:string,
 attemptId:string,
 bindings:Bindings,
):Promise<StoreDispatchResult>{
 return executeAdmittedStagingStoreDispatch(config,operatorToken,attemptId,{
  verifyOperator:bindings.verifyOperator,
  loadAttempt:bindings.loadAttempt,
  dependencies:{
   claimForDispatch:attempt=>claimStoreDispatchWithRestrictedSession(
    attempt,bindings.restrictedSession,bindings.restrictedLoginRole),
   createProviderOrder:bindings.provider.createProviderOrder,
   readProviderOrder:bindings.provider.readProviderOrder,
   correlateVerified:bindings.provider.correlateVerified,
  },
 })
}
