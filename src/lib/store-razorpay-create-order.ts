import 'server-only'
import {createRazorpayOrder} from '@/lib/razorpay'
import {toRazorpaySubunits} from '@/lib/razorpay-money'
import {parseTrustedStoreAmount} from '@/lib/store-provider-amount'
import type {TrustedStoreDispatchAttempt} from '@/lib/store-provider-order-dispatch-core'
import {isSupportedCurrency} from '@/lib/currency'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RECEIPT=/^evs_[0-9a-f]{32}$/

/**
 * Razorpay POST capability for the Store dispatch core.
 *
 * This is intentionally NOT connected to any route, UI, cron, or action.
 * A future authorized operator path must first commit the attempt's
 * prepared -> dispatch_uncertain claim transactionally before calling it.
 * Never retry a failed or timed-out POST from this adapter.
 */
export async function createStoreRazorpayProviderOrder(
 attempt:TrustedStoreDispatchAttempt,amountSubunits:number,
):Promise<{id:string}>{
 if(process.env.STORE_RAZORPAY_PROVIDER_DISPATCH_ENABLED!=='true')
  throw new Error('STORE_PROVIDER_DISPATCH_DISABLED')
 if(attempt.state!=='prepared'
  ||![attempt.attemptId,attempt.intentId,attempt.orderId].every(x=>UUID.test(x))
  ||!RECEIPT.test(attempt.receipt)
  ||!isSupportedCurrency(attempt.currency))
  throw new Error('STORE_PROVIDER_DISPATCH_INVALID_ATTEMPT')

 const amount=parseTrustedStoreAmount(attempt.amount,attempt.currency)
 const verifiedSubunits=toRazorpaySubunits(amount,attempt.currency)
 if(!Number.isSafeInteger(amountSubunits)||amountSubunits<=0||amountSubunits!==verifiedSubunits)
  throw new Error('STORE_PROVIDER_DISPATCH_AMOUNT_MISMATCH')

 // The existing Razorpay implementation validates the POST response and
 // never retries on transport ambiguity. Store intentId is the provider
 // notes' local payment reference; the receipt remains Store-specific.
 return createRazorpayOrder({
  amount:verifiedSubunits,currency:attempt.currency,receipt:attempt.receipt,
  orderId:attempt.orderId,paymentId:attempt.intentId,
 })
}
