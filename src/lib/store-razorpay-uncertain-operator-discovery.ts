import 'server-only'
import {loadAuthorizedUncertainStoreAttempt} from './store-razorpay-uncertain-attempt-adapter'
import {fetchUniqueStoreOrderByTrustedReceipt} from './store-razorpay-receipt-list-read'
import type {StoreProviderOrderEvidence} from './store-razorpay-provider-evidence'

/**
 * Closed, read-only internal operator diagnostic. No route or server action.
 * Discovery evidence is advisory until independently reverified and a distinct
 * authorized correlation transaction is implemented. Never treat this as payment.
 */
export async function inspectUncertainStoreProviderOrderInternally(
 attemptId:string,
 deps:Readonly<{
  loadAttempt?:typeof loadAuthorizedUncertainStoreAttempt
  discover?:typeof fetchUniqueStoreOrderByTrustedReceipt
 }>={},
):Promise<Readonly<{
 attemptId:string;orderId:string;intentId:string;
 evidence:StoreProviderOrderEvidence;paymentReady:false;correlationAuthorized:false
}>>{
 const attempt=await(deps.loadAttempt??loadAuthorizedUncertainStoreAttempt)(attemptId)
 if(attempt.attemptId!==attemptId||
   !['dispatch_uncertain','reconciliation_required'].includes(attempt.state)){
  throw new Error('STORE_PROVIDER_UNCERTAIN_ATTEMPT_INVALID')
 }
 const evidence=await(deps.discover??fetchUniqueStoreOrderByTrustedReceipt)({
  receipt:attempt.receipt,amount:attempt.amount,currency:attempt.currency,
 })
 if(evidence.receipt!==attempt.receipt||evidence.currency!==attempt.currency){
  throw new Error('STORE_PROVIDER_DISCOVERY_EVIDENCE_MISMATCH')
 }
 return {attemptId:attempt.attemptId,orderId:attempt.orderId,intentId:attempt.intentId,
  evidence,paymentReady:false,correlationAuthorized:false}
}
