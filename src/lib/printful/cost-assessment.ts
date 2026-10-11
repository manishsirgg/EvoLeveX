import 'server-only'

import { getPrintfulProductDetail } from './product-detail'
import { verifyPrintfulStoreIdentity } from './store-identity'

const PRODUCT_ID = 479728769
const STORE_ID = '18878485'

export type PrintfulCostLine = {
  sku: string
  catalogVariantId: number
  providerPrice: string | null
  currency: string | null
}
export type PrintfulCostAssessment =
  | { ok: true; items: PrintfulCostLine[]; priced: number; note: string }
  | { ok: false; code: string }

export function parseCatalogCost(body: unknown, expectedId: number): { price: string | null; currency: string | null } {
  if (!body || typeof body !== 'object') throw new Error('INVALID_RESPONSE')
  const root = body as Record<string, unknown>
  const result = root.result
  if (root.code !== 200 || !result || typeof result !== 'object') throw new Error('INVALID_RESPONSE')
  const variant = (result as Record<string, unknown>).variant
  if (!variant || typeof variant !== 'object') throw new Error('INVALID_RESPONSE')
  const record = variant as Record<string, unknown>
  if (record.id !== expectedId) throw new Error('VARIANT_MISMATCH')
  const raw = record.price
  const price = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : null
  if (price !== null && (!/^\d{1,8}(?:\.\d{1,2})?$/.test(price) || !Number.isFinite(Number(price))))
    throw new Error('INVALID_PRICE')
  const currency = typeof record.currency === 'string' && /^[A-Z]{3}$/.test(record.currency) ? record.currency : null
  return { price, currency }
}

// Observational only: neither retail price nor landed cost / shipping / taxes.
// Read from the same Printful product already imported, without any DB or provider writes.
export async function inspectPrintfulCatalogCosts(): Promise<PrintfulCostAssessment> {
  if (process.env.PRINTFUL_STORE_ID !== STORE_ID || !process.env.PRINTFUL_API_TOKEN)
    return { ok: false, code: 'NOT_CONFIGURED' }
  try {
    if (!(await verifyPrintfulStoreIdentity())) return { ok: false, code: 'STORE_NOT_VERIFIED' }
    const detail = await getPrintfulProductDetail(PRODUCT_ID)
    if ('error' in detail || detail.id !== PRODUCT_ID || detail.variants.length !== 18 ||
        detail.variants.some(v => !v.synced || !v.catalogId || !v.sku))
      return { ok: false, code: 'PRODUCT_NOT_READY' }
    const token = process.env.PRINTFUL_API_TOKEN
    const items: PrintfulCostLine[] = []
    // Small fixed group size avoids exhausting upstream rate limits or runtime requests.
    for (let offset = 0; offset < detail.variants.length; offset += 3) {
      const group = detail.variants.slice(offset, offset + 3)
      const results = await Promise.all(group.map(async variant => {
        const catalogVariantId = variant.catalogId!
        const response = await fetch(`https://api.printful.com/products/variant/${catalogVariantId}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, 'X-PF-Store-Id': STORE_ID, Accept: 'application/json' },
          signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error',
        })
        if (!response.ok) throw new Error('CATALOG_UNAVAILABLE')
        const cost = parseCatalogCost(await response.json(), catalogVariantId)
        return { sku: variant.sku!, catalogVariantId, providerPrice: cost.price, currency: cost.currency }
      }))
      items.push(...results)
    }
    return { ok: true, items, priced: items.filter(item => item.providerPrice !== null).length,
      note: 'Provider catalog price observations only. Currency may be unavailable. Excludes printing extras, shipping, taxes, fees, discounts and merchant margin; not checkout or fulfillment prices.' }
  } catch {
    return { ok: false, code: 'PROVIDER_COST_INSPECTION_FAILED' }
  }
}
