import 'server-only'

import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/currency'
import { normalizeRequiredRates } from './provider-validation'

export const FX_PROVIDER = 'open.er-api.com'
const PROVIDER_URL = 'https://open.er-api.com/v6/latest/USD'
const REQUIRED_QUOTES = SUPPORTED_CURRENCIES.map(({ code }) => code).filter(code => code !== DEFAULT_CURRENCY)

export type ProviderRateSet = {
  baseCurrency: typeof DEFAULT_CURRENCY
  provider: typeof FX_PROVIDER
  fetchedAt: string
  rates: Record<Exclude<SupportedCurrency, 'USD'>, string>
}

type ProviderPayload = { result?: unknown; base_code?: unknown; rates?: unknown }

export function parseProviderPayload(payload: unknown, fetchedAt = new Date()): ProviderRateSet {
  if (!payload || typeof payload !== 'object') throw new Error('Malformed FX provider response')
  const { result, base_code: baseCode, rates } = payload as ProviderPayload
  if (result !== 'success' || baseCode !== DEFAULT_CURRENCY || !rates || typeof rates !== 'object' || Array.isArray(rates)) {
    throw new Error('Malformed FX provider response')
  }

  const normalized = normalizeRequiredRates(rates, REQUIRED_QUOTES) as Record<Exclude<SupportedCurrency, 'USD'>, string>

  return { baseCurrency: DEFAULT_CURRENCY, provider: FX_PROVIDER, fetchedAt: fetchedAt.toISOString(), rates: normalized }
}

export async function fetchLatestUsdRates(): Promise<ProviderRateSet> {
  const response = await fetch(PROVIDER_URL, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`FX provider request failed (${response.status})`)
  return parseProviderPayload(await response.json())
}
