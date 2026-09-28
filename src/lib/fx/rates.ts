import 'server-only'

import { isSupportedCurrency } from '@/lib/currency'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { fetchLatestUsdRates } from './provider'
import { resolveCachedRate, type ResolvedRate } from './policy'

export type TrustedExchangeRate = ResolvedRate

export async function refreshUsdExchangeRates() {
  const rateSet = await fetchLatestUsdRates()
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('replace_usd_currency_exchange_rates', {
    p_provider: rateSet.provider,
    p_fetched_at: rateSet.fetchedAt,
    p_rates: rateSet.rates,
  })
  if (error || data !== 9) throw new Error(`FX cache refresh failed${error ? `: ${error.message}` : ''}`)
  return { ok: true as const, provider: rateSet.provider, baseCurrency: rateSet.baseCurrency, rateCount: data, fetchedAt: rateSet.fetchedAt }
}

export async function getExchangeRate(baseCurrency: unknown, quoteCurrency: unknown): Promise<TrustedExchangeRate> {
  if (!isSupportedCurrency(baseCurrency) || !isSupportedCurrency(quoteCurrency)) throw new Error('Unsupported currency')
  if (baseCurrency === quoteCurrency) return resolveCachedRate(baseCurrency, quoteCurrency, null)
  if (baseCurrency !== 'USD') throw new Error(`Trusted FX base ${baseCurrency} is not available`)

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('currency_exchange_rates')
    .select('rate,provider,fetched_at')
    .eq('base_currency', baseCurrency)
    .eq('quote_currency', quoteCurrency)
    .maybeSingle()
  if (error) throw new Error(`Trusted FX rate lookup failed: ${error.message}`)
  return resolveCachedRate(baseCurrency, quoteCurrency, data)
}
