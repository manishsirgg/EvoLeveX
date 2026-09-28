import 'server-only'

import { cookies } from 'next/headers'

import { DEFAULT_CURRENCY, isSupportedCurrency, type SupportedCurrency } from '@/lib/currency'

export const CURRENCY_COOKIE_NAME = 'evo_currency'

export async function getCurrencyPreference(): Promise<SupportedCurrency> {
  const value = (await cookies()).get(CURRENCY_COOKIE_NAME)?.value
  return isSupportedCurrency(value) ? value : DEFAULT_CURRENCY
}
