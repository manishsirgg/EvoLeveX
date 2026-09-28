import 'server-only'

import { isSupportedCurrency, type SupportedCurrency } from '@/lib/currency'
import { multiplyAndRoundDecimal } from './decimal'
import { getExchangeRate } from './rates'

export function currencyDecimalPlaces(currency: SupportedCurrency): number {
  return currency === 'JPY' ? 0 : 2
}

export function convertDecimalAmount(amount: string | number, rate: string | number, targetCurrency: SupportedCurrency): string {
  return multiplyAndRoundDecimal(amount, rate, currencyDecimalPlaces(targetCurrency))
}

export async function convertMoney({ amount, baseCurrency, targetCurrency }: {
  amount: string | number
  baseCurrency: unknown
  targetCurrency: unknown
}): Promise<{ amount: string; currency: SupportedCurrency; rate: string }> {
  if (!isSupportedCurrency(baseCurrency) || !isSupportedCurrency(targetCurrency)) throw new Error('Unsupported currency')
  const trustedRate = await getExchangeRate(baseCurrency, targetCurrency)
  return { amount: convertDecimalAmount(amount, trustedRate.rate, targetCurrency), currency: targetCurrency, rate: trustedRate.rate }
}
