import 'server-only'

import { isSupportedCurrency, type SupportedCurrency } from '@/lib/currency'
import { convertMoney } from './money'

export type StorefrontPrice = {
  amount: string | number
  currency: SupportedCurrency
}

export async function resolveStorefrontPrice({ baseAmount, baseCurrency, selectedCurrency }: {
  baseAmount: string | number
  baseCurrency: SupportedCurrency
  selectedCurrency: SupportedCurrency
}): Promise<StorefrontPrice> {
  const canonicalPrice = { amount: baseAmount, currency: baseCurrency }

  if (!isSupportedCurrency(baseCurrency) || selectedCurrency === baseCurrency) return canonicalPrice

  try {
    const converted = await convertMoney({ amount: baseAmount, baseCurrency, targetCurrency: selectedCurrency })
    return { amount: converted.amount, currency: converted.currency }
  } catch {
    // A missing, invalid, expired, or otherwise unavailable trusted rate must
    // never produce an apparent customer price. Preserve the canonical price.
    return canonicalPrice
  }
}
