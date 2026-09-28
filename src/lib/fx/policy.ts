export const FX_FRESH_FOR_MS = 30 * 60 * 60 * 1000
export const FX_MAX_AGE_MS = 72 * 60 * 60 * 1000

export type RateFreshness = 'fresh' | 'stale'
export type CachedRateRow = { rate: string | number; provider: string; fetched_at: string }
export type ResolvedRate = { rate: string; fetchedAt: string; provider: string; freshness: RateFreshness }

export function getRateFreshness(fetchedAt: string | Date, now = new Date()): RateFreshness {
  const fetchedTime = fetchedAt instanceof Date ? fetchedAt.getTime() : Date.parse(fetchedAt)
  const age = now.getTime() - fetchedTime

  if (!Number.isFinite(fetchedTime) || age < -5 * 60 * 1000) {
    throw new Error('Trusted FX rate has an invalid fetch timestamp')
  }
  if (age > FX_MAX_AGE_MS) throw new Error('Trusted FX rate has expired')
  return age <= FX_FRESH_FOR_MS ? 'fresh' : 'stale'
}

export function resolveCachedRate(baseCurrency: string, quoteCurrency: string, row: CachedRateRow | null, now = new Date()): ResolvedRate {
  if (baseCurrency === quoteCurrency) {
    return { rate: '1', fetchedAt: now.toISOString(), provider: 'identity', freshness: 'fresh' }
  }
  if (!row) throw new Error(`No trusted ${baseCurrency}/${quoteCurrency} FX rate is cached`)
  return {
    rate: String(row.rate),
    provider: row.provider,
    fetchedAt: row.fetched_at,
    freshness: getRateFreshness(row.fetched_at, now),
  }
}
