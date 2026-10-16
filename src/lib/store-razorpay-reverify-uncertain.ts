import 'server-only'
import {loadAuthorizedUncertainStoreAttempt} from './store-razorpay-uncertain-attempt-adapter'
import {fetchUniqueStoreOrderByTrustedReceipt} from './store-razorpay-receipt-list-read'
import {fetchVerifiedStoreProviderOrder} from './store-razorpay-provider-read'
import {checkIndependentRecoveryEvidence} from './store-razorpay-reverification-core'

/**
 * Closed administrator-only evidence revalidation. No public handler, payment
 * confirmation, or correlation mutation. A separate operator transaction is
 * required before any evidence can be persisted.
 */
export async function reverifyUncertainStoreOrderInternally(attemptId:string){
 const a=await loadAuthorizedUncertainStoreAttempt(attemptId)
 const first=await fetchUniqueStoreOrderByTrustedReceipt({
   receipt:a.receipt,amount:a.amount,currency:a.currency,
 })
 const second=await fetchVerifiedStoreProviderOrder({
   providerOrderId:first.id,receipt:a.receipt,amount:a.amount,currency:a.currency,
 })
 checkIndependentRecoveryEvidence(a,first,second)
 // Re-authorize and re-read after network access, rejecting changed records.
 const latest=await loadAuthorizedUncertainStoreAttempt(attemptId)
 if(latest.attemptId!==a.attemptId||latest.orderId!==a.orderId
    ||latest.intentId!==a.intentId||latest.receipt!==a.receipt
    ||latest.amount!==a.amount||latest.currency!==a.currency
    ||latest.state!==a.state)
   throw new Error('STORE_RECOVERY_ATTEMPT_CHANGED')
 return {attemptId:a.attemptId,orderId:a.orderId,intentId:a.intentId,
  evidence:second,paymentReady:false as const,correlationAuthorized:false as const}
}
