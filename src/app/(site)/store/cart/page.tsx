import type { Metadata } from 'next'

import { StoreCartPage } from '@/components/store/store-cart-page'
import { getCurrencyPreference } from '@/lib/currency-preference'

export const metadata: Metadata = { title: 'Store Cart', description: 'Review your Evo Store cart.' }

export default async function CartPage() {
  return <StoreCartPage currency={await getCurrencyPreference()} />
}
