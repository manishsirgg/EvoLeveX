import 'server-only'
import {
 dispatchStoreProviderOrderOnce,
 type StoreDispatchDependencies,
 type StoreDispatchResult,
 type TrustedStoreDispatchAttempt,
} from '@/lib/store-provider-order-dispatch-core'
import {createStoreRazorpayProviderOrder} from '@/lib/store-razorpay-create-order'
import {fetchVerifiedStoreProviderOrder} from '@/lib/store-razorpay-provider-read'

/**
 * Compose real Razorpay POST and independent GET with the existing Store
 * single-dispatch protocol. No route, UI, cron or ordinary user session calls
 * this module.
 *
 * The authorized operator worker MUST supply a durable atomic claim and
 * audited verified-correlation capability. Neither capability can be replaced
 * by a browser request or a successful provider POST response.
 */
export type AuthorizedStoreDispatchPersistence = Pick<
 StoreDispatchDependencies,'claimForDispatch'|'correlateVerified'
>

export async function dispatchAuthorizedStoreRazorpayOrder(
 attempt:TrustedStoreDispatchAttempt,
 persistence:AuthorizedStoreDispatchPersistence,
):Promise<StoreDispatchResult>{
 // No database mutation or provider call may occur without explicit activation.
 if(process.env.STORE_RAZORPAY_PROVIDER_DISPATCH_ENABLED!=='true')
  throw new Error('STORE_PROVIDER_DISPATCH_DISABLED')

 return dispatchStoreProviderOrderOnce(attempt,{
  claimForDispatch:persistence.claimForDispatch,
  createProviderOrder:createStoreRazorpayProviderOrder,
  readProviderOrder:async providerOrderId=>fetchVerifiedStoreProviderOrder({
   providerOrderId,receipt:attempt.receipt,
   amount:attempt.amount,currency:attempt.currency,
  }),
  correlateVerified:persistence.correlateVerified,
 })
}
