export function normalizeRequiredRates(rates: unknown, requiredQuotes: readonly string[]): Record<string, string> {
  if (!rates || typeof rates !== 'object' || Array.isArray(rates)) throw new Error('Malformed FX provider response')
  const normalized: Record<string, string> = {}
  for (const quote of requiredQuotes) {
    const value = (rates as Record<string, unknown>)[quote]
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`Missing or invalid FX rate for ${quote}`)
    }
    normalized[quote] = String(value)
  }
  return normalized
}
