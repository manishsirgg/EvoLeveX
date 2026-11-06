import type { Metadata } from 'next'
import { StoreCheckoutReview } from '@/components/store/store-checkout-review'
import { getCurrencyPreference } from '@/lib/currency-preference'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Checkout Review — Evo Store',
  robots: { index: false, follow: false },
}
export default async function StoreCheckoutPage() {
  // First release is deliberately gated on both server-side controls.
  // No user-facing reservation action is enabled on a normal deployment.
  const reservationEnabled = process.env.STORE_V1_RESERVATION_UI_ENABLED === 'true'
    && process.env.STORE_RESERVATION_BRIDGE_ENABLED === 'true'
  const finalizationEnabled = reservationEnabled && process.env.STORE_V1_FINALIZATION_UI_ENABLED === 'true'
  const paymentPreflightEnabled = finalizationEnabled && process.env.STORE_V1_PAYMENT_PREFLIGHT_UI_ENABLED === 'true'
  const intentClaimEnabled = paymentPreflightEnabled && process.env.STORE_V1_INTENT_CLAIM_UI_ENABLED === 'true'
  let addresses: {id:string;is_default:boolean;full_name:string;address_line1:string;city:string;state:string;postal_code:string;country:string}[] = []
  let addressLoadFailed = false
  let isSignedIn = false
  {
    const supabase = await createClient()
    const {data:{user},error:authError} = await supabase.auth.getUser()
    if (!authError && user) {
      isSignedIn = true
      const {data,error} = await supabase.from('addresses')
        .select('id,is_default,full_name,address_line1,city,state,postal_code,country').eq('user_id',user.id)
        .order('is_default',{ascending:false}).order('created_at',{ascending:false})
      if (error) addressLoadFailed = true
      else addresses = (data ?? []).filter((a):a is typeof addresses[number] =>
        typeof a.id === 'string' && typeof a.is_default === 'boolean' &&
        typeof a.full_name === 'string' && typeof a.address_line1 === 'string' &&
        typeof a.city === 'string' && typeof a.state === 'string' &&
        typeof a.postal_code === 'string' && typeof a.country === 'string')
    }
  }
  return <StoreCheckoutReview
    currency={await getCurrencyPreference()}
    reservationEnabled={reservationEnabled}
    finalizationEnabled={finalizationEnabled}
    paymentPreflightEnabled={paymentPreflightEnabled}
    intentClaimEnabled={intentClaimEnabled}
    addresses={addresses}
    addressLoadFailed={addressLoadFailed}
    isSignedIn={isSignedIn}
  />
}
