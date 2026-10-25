import 'server-only'
import {assertStoreWorkerAdmission,type WorkerAdmissionConfig} from './store-worker-admission'
import {dispatchStoreProviderOrderOnce,type StoreDispatchDependencies,type StoreDispatchResult,type TrustedStoreDispatchAttempt} from './store-provider-order-dispatch-core'

type StagingDispatchBindings=Readonly<{
 verifyOperator:(token:string)=>Promise<string>
 loadAttempt:(attemptId:string,operatorId:string)=>Promise<TrustedStoreDispatchAttempt>
 dependencies:StoreDispatchDependencies
}>

/**
 * Staging-only admitted worker handoff. No HTTP route, queue subscription,
 * database privileges, secret retrieval, provider API or default dependencies.
 * Caller must supply independently reviewed capabilities from an isolated
 * worker, not from a request body or ordinary Next.js deployment.
 */
export async function executeAdmittedStagingStoreDispatch(
 config:WorkerAdmissionConfig,
 operatorToken:string,
 attemptId:string,
 bindings:StagingDispatchBindings,
):Promise<StoreDispatchResult>{
 // Admission check executes before calling identity, database or provider code.
 assertStoreWorkerAdmission(config)
 if(typeof operatorToken!=='string'||operatorToken.length<16
   ||typeof attemptId!=='string'
   ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId))
  throw new Error('STORE_STAGING_DISPATCH_ARGUMENT_INVALID')
 const operatorId=await bindings.verifyOperator(operatorToken)
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operatorId))
  throw new Error('STORE_STAGING_DISPATCH_OPERATOR_INVALID')
 const trusted=await bindings.loadAttempt(attemptId,operatorId)
 if(trusted.attemptId!==attemptId||trusted.state!=='prepared')
  throw new Error('STORE_STAGING_DISPATCH_ATTEMPT_UNAVAILABLE')
 return dispatchStoreProviderOrderOnce(trusted,bindings.dependencies)
}
