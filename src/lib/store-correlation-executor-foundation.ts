import { recordVerifiedCorrelationViaRestrictedExecutor } from './store-provider-correlation-contract.ts'
import type { TrustedCorrelationInput, CorrelationResult, RestrictedCorrelationExecutor } from './store-provider-correlation-contract.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type VerifiedExecutorContext = Readonly<{
 operatorId: string
 attemptId: string
 nonce: string
 issuedAtMs: number
 verifiedAtMs: number
}>
export type ExecutorClock = () => number
const FRESHNESS_MS = 60_000

/**
 * Isolated worker protocol foundation, not a deployed privileged executor.
 * Context MUST be constructed inside a trusted worker from a verified operator
 * session and fresh provider GET, not from caller JSON. No DB credentials here.
 * Replay protection must be atomic/durable in a future worker implementation.
 */
export async function executeStoreCorrelationWithVerifiedContext(
 context: VerifiedExecutorContext,
 input: TrustedCorrelationInput,
 execute: RestrictedCorrelationExecutor,
 clock: ExecutorClock = Date.now,
): Promise<CorrelationResult> {
 const now = clock()
 if(!UUID.test(context.operatorId) || !UUID.test(context.attemptId)
   || context.operatorId!==input.operatorId || context.attemptId!==input.attemptId)
   throw new Error('STORE_EXECUTOR_CONTEXT_IDENTITY_INVALID')
 if(!/^[a-f0-9]{32,64}$/i.test(context.nonce))
   throw new Error('STORE_EXECUTOR_NONCE_INVALID')
 if(!Number.isSafeInteger(now) || !Number.isSafeInteger(context.issuedAtMs)
   || !Number.isSafeInteger(context.verifiedAtMs)
   || context.issuedAtMs>context.verifiedAtMs
   || context.verifiedAtMs>now || context.issuedAtMs>now
   || now-context.verifiedAtMs>FRESHNESS_MS)
   throw new Error('STORE_EXECUTOR_CONTEXT_EXPIRED')
 return recordVerifiedCorrelationViaRestrictedExecutor(input, execute)
}
