import 'server-only'
import {executeAdmittedStagingStoreDispatch} from './store-staging-admitted-dispatch'
import {claimStagingStoreDispatchWithNodePg} from './store-staging-node-pg-dispatch'
import type {StorePgSecrets} from './store-staging-pg-driver-config'
import type {TrustedStoreDispatchAttempt,StoreDispatchDependencies,StoreDispatchResult} from './store-provider-order-dispatch-core'
import type {WorkerAdmissionConfig} from './store-worker-admission'

type StagingNodePgBindings=Readonly<{
 verifyOperator:(token:string)=>Promise<string>
 loadAttempt:(attemptId:string,operatorId:string)=>Promise<TrustedStoreDispatchAttempt>
 database:Readonly<{secrets:StorePgSecrets;expectedLoginRole:string}>
 // These are never installed by this module. Provider dispatch must remain
 // disabled until staging evidence and recovery are independently audited.
 provider:Pick<StoreDispatchDependencies,'createProviderOrder'|'readProviderOrder'|'correlateVerified'>
}>

/**
 * Staging-only integration of admitted worker with the real Node pg client.
 * The external isolated worker MUST securely own the secrets, operator identity
 * and provider callbacks. This module creates no route, worker process, cron,
 * role grant, Razorpay call or payment confirmation.
 */
export async function executeAdmittedStagingDispatchWithNodePg(
 config:WorkerAdmissionConfig,
 operatorToken:string,
 attemptId:string,
 bindings:StagingNodePgBindings,
):Promise<StoreDispatchResult>{
 return executeAdmittedStagingStoreDispatch(config,operatorToken,attemptId,{
  verifyOperator:bindings.verifyOperator,
  loadAttempt:bindings.loadAttempt,
  dependencies:{
   claimForDispatch:attempt=>claimStagingStoreDispatchWithNodePg(
    attempt,bindings.database.expectedLoginRole,bindings.database.secrets),
   createProviderOrder:bindings.provider.createProviderOrder,
   readProviderOrder:bindings.provider.readProviderOrder,
   correlateVerified:bindings.provider.correlateVerified,
  },
 })
}
