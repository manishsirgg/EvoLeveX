import 'server-only'
import {toRazorpaySubunits} from './razorpay-money'
import {verifyStoreProviderOrderEvidence, type StoreProviderOrderEvidence} from './store-razorpay-provider-evidence'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RECEIPT=/^evs_[0-9a-f]{32}$/
const PROVIDER_ID=/^order_[A-Za-z0-9]{8,64}$/

export type TrustedStoreDispatchAttempt=Readonly<{
 attemptId:string;intentId:string;orderId:string;receipt:string;
 amount:string;currency:string;state:'prepared'
}>
export type StoreDispatchResult=Readonly<{
 attemptId:string;providerOrderId:string;correlated:true;paymentReady:false
}>
export type StoreDispatchDependencies=Readonly<{
 // Must commit an atomic prepared -> dispatch_uncertain transition BEFORE provider POST.
 // Return false when another worker has already claimed or attempted dispatch.
 claimForDispatch:(attempt:TrustedStoreDispatchAttempt)=>Promise<boolean>
 // Must make precisely one provider POST. Never automatically retry on timeout.
 createProviderOrder:(attempt:TrustedStoreDispatchAttempt,amountSubunits:number)=>Promise<{id:string}>
 // Independent GET against Razorpay, not reuse of the POST response.
 readProviderOrder:(providerOrderId:string)=>Promise<unknown>
 // Only authorized internal operator service can persist a verified correlation.
 correlateVerified:(attempt:TrustedStoreDispatchAttempt,evidence:StoreProviderOrderEvidence)=>Promise<{correlated:boolean;payment_ready:boolean;provider_order_id:string}>
}>

/** No production caller or credential wiring. Only a separately authorized server
 * service may supply these capabilities after DB role and dispatch reviews.
 * Any failure AFTER dispatch claim is uncertain and needs reconciliation, never POST retry.
 */
export async function dispatchStoreProviderOrderOnce(
 attempt:TrustedStoreDispatchAttempt,deps:StoreDispatchDependencies,
):Promise<StoreDispatchResult>{
 if(![attempt.attemptId,attempt.intentId,attempt.orderId].every(x=>UUID.test(x))
   ||!RECEIPT.test(attempt.receipt)||attempt.state!=='prepared')
  throw new Error('STORE_DISPATCH_INVALID_ATTEMPT')
 const amount=toRazorpaySubunits(attempt.amount,attempt.currency)
 if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('STORE_DISPATCH_INVALID_AMOUNT')
 const claimed=await deps.claimForDispatch(attempt)
 if(claimed!==true)throw new Error('STORE_DISPATCH_NOT_CLAIMED')
 // No catch/retry path may issue a second POST after this point.
 let providerId:string
 try{
  const created=await deps.createProviderOrder(attempt,amount)
  if(!created||!PROVIDER_ID.test(created.id))throw new Error('STORE_DISPATCH_PROVIDER_RESPONSE_INVALID')
  providerId=created.id
  const raw=await deps.readProviderOrder(providerId)
  const verified=verifyStoreProviderOrderEvidence({
   providerOrderId:providerId,receipt:attempt.receipt,
   amount:attempt.amount,currency:attempt.currency,
  },raw)
  const correlation=await deps.correlateVerified(attempt,verified)
  if(correlation.correlated!==true||correlation.payment_ready!==false
    ||correlation.provider_order_id!==providerId)
   throw new Error('STORE_DISPATCH_CORRELATION_INVALID')
 }catch{
  // An ambiguous POST, GET failure or correlation failure must be handled
  // by a separate audited reconciliation worker, not a second customer request.
  throw new Error('STORE_DISPATCH_RECONCILIATION_REQUIRED')
 }
 return {attemptId:attempt.attemptId,providerOrderId:providerId,correlated:true,paymentReady:false}
}
