import 'server-only'
import { validateShippingQuoteInput, type QuoteCountry } from './shipping-quote-contract'

type ShippingOption = { id: string; name: string; rate: string; currency: string }
export type ShippingProbeResult =
  | { ok: true; options: ShippingOption[]; note: string }
  | { ok: false; code: 'DISABLED' | 'NOT_CONFIGURED' | 'INVALID_INPUT' | 'UNAUTHORIZED' | 'PROVIDER_REJECTED' | 'UNAVAILABLE' }

const STORE_ID = '18878485'
const CATALOG_VARIANT_ID = 4866 // Approved Black / S T-shirt catalog variant; not a sync product ID.
const MAX_OPTIONS = 20

// One explicitly gated, non-order quote probe using a fixed known variant and example destination.
// Never accept user-provided provider IDs, shipping quantities, URLs, or currency.
export async function probePrintfulShippingRate(country: QuoteCountry): Promise<ShippingProbeResult> {
  if (process.env.PRINTFUL_SHIPPING_PROBE_ENABLED !== 'true') return { ok: false, code: 'DISABLED' }
  if (process.env.PRINTFUL_STORE_ID !== STORE_ID || !process.env.PRINTFUL_API_TOKEN) return { ok: false, code: 'NOT_CONFIGURED' }
  if (country !== 'IN' && country !== 'US') return { ok: false, code: 'INVALID_INPUT' }
  const validated = validateShippingQuoteInput({
    countryCode: country,
    stateCode: country === 'US' ? 'CA' : undefined,
    catalogVariantId: CATALOG_VARIANT_ID,
    quantity: 1,
  })
  if (!validated.ok) return { ok: false, code: 'INVALID_INPUT' }

  try {
    const response = await fetch('https://api.printful.com/shipping/rates', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
        'X-PF-Store-Id': STORE_ID,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(validated.request),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 401 || response.status === 403) return { ok: false, code: 'UNAUTHORIZED' }
    if (!response.ok) return { ok: false, code: 'PROVIDER_REJECTED' }
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return { ok: false, code: 'PROVIDER_REJECTED' }
    const root = payload as Record<string, unknown>
    if (root.code !== 200 || !Array.isArray(root.result) || root.result.length > MAX_OPTIONS) return { ok: false, code: 'PROVIDER_REJECTED' }
    const options: ShippingOption[] = []
    for (const item of root.result) {
      if (!item || typeof item !== 'object') return { ok: false, code: 'PROVIDER_REJECTED' }
      const value = item as Record<string, unknown>
      if (typeof value.id !== 'string' || value.id.length > 60 || typeof value.name !== 'string' || value.name.length > 160 ||
        typeof value.rate !== 'string' || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value.rate) ||
        typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)) return { ok: false, code: 'PROVIDER_REJECTED' }
      options.push({ id: value.id, name: value.name, rate: value.rate, currency: value.currency })
    }
    return { ok: true, options, note: 'Illustrative one-item country/state-only quote. Not a checkout price; real shipping requires validated customer postal address and a new quote at checkout. No orders created.' }
  } catch {
    return { ok: false, code: 'UNAVAILABLE' }
  }
}
