import 'server-only'
import { fetchVerifiedStoreProviderOrder } from './store-razorpay-provider-read'
import type { StoreProviderOrderExpectation } from './store-razorpay-provider-evidence'

/**
 * Closed internal seam: no HTTP handler or scheduled task invokes this function.
 * A future operator integration MUST implement DB-backed authz and a restricted
 * DB execution path; never pass client-supplied Store expectations.
 */
export type TrustedStoreProviderAttempt = Readonly<{
  attemptId: string
  orderId: string
  intentId: string
  providerOrderId: string
  receipt: string
  amount: string
  currency: string
  state: 'dispatch_uncertain' | 'reconciliation_required' | 'correlated'
}>
export type OperatorVerificationDependencies = {
  authorizeOperator: () => Promise<boolean>
  loadTrustedAttempt: (attemptId: string) => Promise<TrustedStoreProviderAttempt | null>
  // Must call the protected DB correlation function using a dedicated, audited operator context.
  correlate: (attempt: TrustedStoreProviderAttempt, evidence: {
    id: string; receipt: string; amount: number; currency: string
  }) => Promise<void>
  verifyProvider?: (expected: StoreProviderOrderExpectation) => ReturnType<typeof fetchVerifiedStoreProviderOrder>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const RECEIPT = /^evs_[0-9a-f]{32}$/

export async function reconcileStoreProviderOrderInternally(
  attemptId: string,
  deps: OperatorVerificationDependencies,
): Promise<{ verified: true; paymentReady: false }> {
  if (!UUID.test(attemptId)) throw new Error('STORE_PROVIDER_ATTEMPT_INVALID')
  if (!await deps.authorizeOperator()) throw new Error('STORE_PROVIDER_OPERATOR_UNAUTHORIZED')
  const attempt = await deps.loadTrustedAttempt(attemptId)
  if (!attempt || attempt.attemptId !== attemptId
    || !UUID.test(attempt.orderId) || !UUID.test(attempt.intentId)
    || !PROVIDER_ID.test(attempt.providerOrderId) || !RECEIPT.test(attempt.receipt)
    || !['dispatch_uncertain', 'reconciliation_required', 'correlated'].includes(attempt.state)) {
    throw new Error('STORE_PROVIDER_TRUSTED_ATTEMPT_INVALID')
  }
  const expected: StoreProviderOrderExpectation = {
    providerOrderId: attempt.providerOrderId,
    receipt: attempt.receipt,
    amount: attempt.amount,
    currency: attempt.currency,
  }
  const evidence = await (deps.verifyProvider ?? fetchVerifiedStoreProviderOrder)(expected)
  if (evidence.id !== expected.providerOrderId || evidence.receipt !== expected.receipt
    || evidence.currency !== expected.currency) {
    throw new Error('STORE_PROVIDER_VERIFICATION_MISMATCH')
  }
  await deps.correlate(attempt, evidence)
  return { verified: true, paymentReady: false }
}
