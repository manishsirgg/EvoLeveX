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
  let addresses: {id:string;is_default:boolean}[] = []
  let addressLoadFailed = false
  if (reservationEnabled) {
    const supabase = await createClient()
    const {data:{user},error:authError} = await supabase.auth.getUser()
    if (!authError && user) {
      const {data,error} = await supabase.from('addresses')
        .select('id,is_default').eq('user_id',user.id)
      if (error) addressLoadFailed = true
      else addresses = (data ?? []).filter((a):a is {id:string;is_default:boolean} =>
        typeof a.id === 'string' && typeof a.is_default === 'boolean')
    }
  }
  return <StoreCheckoutReview
    currency={await getCurrencyPreference()}
    reservationEnabled={reservationEnabled}
    addresses={addresses}
    addressLoadFailed={addressLoadFailed}
  />
}
