import 'server-only'

import { loadAuthorizedStoreProviderAttempt } from './store-razorpay-trusted-attempt-adapter'
import { fetchVerifiedStoreProviderOrder } from './store-razorpay-provider-read'
import type { StoreProviderOrderEvidence } from './store-razorpay-provider-evidence'

/**
 * Internal operator-only verification boundary.
 * The expected order/receipt/amount/currency are exclusively loaded from
 * the audited authenticated database RPC, never from caller-supplied values.
 * This reads Razorpay Orders GET; it does not correlate, capture, settle,
 * create a payment, mark an order paid, or authorize Printful fulfillment.
 *
 * Do not expose this directly through an HTTP route, server action or cron
 * until a separately reviewed operator endpoint and abuse controls exist.
 */
export async function verifyExistingStoreProviderOrderInternally(
  attemptId: string,
  dependencies: Readonly<{
    loadAttempt?: typeof loadAuthorizedStoreProviderAttempt
    fetchEvidence?: typeof fetchVerifiedStoreProviderOrder
  }> = {},
): Promise<Readonly<{
  verified: true
  paymentReady: false
  attemptId: string
  orderId: string
  intentId: string
  evidence: StoreProviderOrderEvidence
}>> {
  const attempt = await (dependencies.loadAttempt ?? loadAuthorizedStoreProviderAttempt)(attemptId)
  if (attempt.state !== 'correlated') {
    throw new Error('STORE_PROVIDER_ATTEMPT_NOT_CORRELATED')
  }
  const evidence = await (dependencies.fetchEvidence ?? fetchVerifiedStoreProviderOrder)({
    providerOrderId: attempt.providerOrderId,
    receipt: attempt.receipt,
    amount: attempt.amount,
    currency: attempt.currency,
  })
  // Defense in depth in case a future adapter changes verification behavior.
  if (evidence.id !== attempt.providerOrderId
    || evidence.receipt !== attempt.receipt
    || evidence.currency !== attempt.currency) {
    throw new Error('STORE_PROVIDER_VERIFICATION_MISMATCH')
  }
  return {
    verified: true, paymentReady: false,
    attemptId: attempt.attemptId,
    orderId: attempt.orderId,
    intentId: attempt.intentId,
    evidence,
  }
}
