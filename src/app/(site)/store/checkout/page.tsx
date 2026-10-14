import type { Metadata } from 'next'
import { StoreCheckoutReview } from '@/components/store/store-checkout-review'
import { getCurrencyPreference } from '@/lib/currency-preference'

export const metadata: Metadata = {
  title: 'Checkout Review — Evo Store',
  robots: { index: false, follow: false },
}
export default async function StoreCheckoutPage() {
  return <StoreCheckoutReview currency={await getCurrencyPreference()} />
}
