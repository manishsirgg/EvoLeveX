import 'server-only'
import {executeAdmittedStagingStoreDispatch} from './store-staging-admitted-dispatch'
import {claimStagingStoreDispatchWithDedicatedPgClient,type StagingClaimPgClient} from './store-staging-pg-dispatch-session'
import type {TrustedStoreDispatchAttempt,StoreDispatchDependencies,StoreDispatchResult} from './store-provider-order-dispatch-core'
import type {WorkerAdmissionConfig} from './store-worker-admission'

type Bindings=Readonly<{
 verifyOperator:(token:string)=>Promise<string>
 loadAttempt:(attemptId:string,operatorId:string)=>Promise<TrustedStoreDispatchAttempt>
 createRestrictedPgClient:()=>StagingClaimPgClient
 restrictedLoginRole:string
 // Real provider dispatch, GET and correlation capabilities remain external and disabled.
 provider:Pick<StoreDispatchDependencies,'createProviderOrder'|'readProviderOrder'|'correlateVerified'>
}>

/** Restricted claim integration for an isolated staging worker. This module does
 * not provision grants, start a worker or issue HTTP requests.
 * The isolated worker supplies a dedicated restricted PG constructor. Each
 * claim opens, verifies and closes its own connection; it cannot use a stale
 * or request-shared session.
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
   claimForDispatch:attempt=>claimStagingStoreDispatchWithDedicatedPgClient(
    attempt,bindings.restrictedLoginRole,bindings.createRestrictedPgClient),
   createProviderOrder:bindings.provider.createProviderOrder,
   readProviderOrder:bindings.provider.readProviderOrder,
   correlateVerified:bindings.provider.correlateVerified,
  },
 })
}
