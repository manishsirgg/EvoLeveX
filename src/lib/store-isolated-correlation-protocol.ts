import {randomBytes} from 'node:crypto'
import {executeStoreCorrelationWithVerifiedContext} from './store-correlation-executor-foundation.ts'
import {checkIndependentRecoveryEvidence} from './store-razorpay-reverification-core.ts'
import type {TrustedCorrelationInput,RestrictedCorrelationExecutor} from './store-provider-correlation-contract.ts'
import type {StoreProviderOrderEvidence} from './store-razorpay-provider-evidence.ts'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
type WorkerAttempt=Readonly<{
 attemptId:string;orderId:string;intentId:string;receipt:string;
 amount:string;currency:string;state:'dispatch_uncertain'|'reconciliation_required'
}>
export type WorkerBoundaryDependencies=Readonly<{
 /** Must validate session cryptographically, NEVER trust an operatorId field in job JSON. */
 authenticateOperator:()=>Promise<string>
 /** Must query authoritative role table again at mutation time. */
 authorizeOperator:(operatorId:string)=>Promise<boolean>
 /** Must reload attempt from independently authorized durable data. */
 loadAttempt:(attemptId:string,operatorId:string)=>Promise<WorkerAttempt>
 /** Must perform bounded Razorpay receipt query; never accept caller-supplied evidence. */
 discover:(attempt:WorkerAttempt)=>Promise<StoreProviderOrderEvidence>
 /** Must perform independent Razorpay Orders GET using the candidate order ID. */
 verify:(attempt:WorkerAttempt,providerOrderId:string)=>Promise<StoreProviderOrderEvidence>
 /** Future implementation: one DB transaction atomically consumes nonce and correlates. */
 execute:RestrictedCorrelationExecutor
 now?:()=>number
 nonce?:()=>string
}>

/**
 * Pure orchestration intended for an isolated privileged worker.
 * Only an attempt UUID may be submitted; the authenticated operator, provider
 * evidence, timestamps and nonce are generated inside the trusted boundary.
 * Nothing in this module creates a production endpoint or DB privilege.
 */
export async function runIsolatedStoreCorrelationProtocol(
 attemptId:string,deps:WorkerBoundaryDependencies,
){
 if(!UUID.test(attemptId))throw new Error('STORE_WORKER_ATTEMPT_INVALID')
 const operatorId=await deps.authenticateOperator()
 if(!UUID.test(operatorId)||!await deps.authorizeOperator(operatorId))
  throw new Error('STORE_WORKER_OPERATOR_DENIED')
 const attempt=await deps.loadAttempt(attemptId,operatorId)
 if(attempt.attemptId!==attemptId||!['dispatch_uncertain','reconciliation_required'].includes(attempt.state))
  throw new Error('STORE_WORKER_ATTEMPT_UNAVAILABLE')
 const discovered=await deps.discover(attempt)
 const verified=await deps.verify(attempt,discovered.id)
 checkIndependentRecoveryEvidence(attempt,discovered,verified)
 // Recheck authoritative permissions and state after any network round trip.
 if(!await deps.authorizeOperator(operatorId))
  throw new Error('STORE_WORKER_OPERATOR_REVOKED')
 const latest=await deps.loadAttempt(attemptId,operatorId)
 if(Object.keys(attempt).some(key=>latest[key as keyof WorkerAttempt]!==attempt[key as keyof WorkerAttempt]))
  throw new Error('STORE_WORKER_ATTEMPT_CHANGED')
 const now=deps.now??Date.now
 const verifiedAtMs=now()
 const input:TrustedCorrelationInput={
  attemptId,operatorId,orderId:attempt.orderId,intentId:attempt.intentId,
  receipt:attempt.receipt,amount:attempt.amount,currency:attempt.currency,provider:verified,
 }
 return executeStoreCorrelationWithVerifiedContext({
  operatorId,attemptId,nonce:(deps.nonce??(()=>randomBytes(16).toString('hex')))(),
  issuedAtMs:verifiedAtMs,verifiedAtMs,
 },input,deps.execute,now)
}
