import 'server-only'

import { getPrintfulProductDetail } from './product-detail'

const STORE_ID = '18878485'
const option = /^[A-Z0-9][A-Z0-9._/-]{0,31}$/
const skuPattern = /^[A-Z0-9][A-Z0-9._/-]{0,63}$/

export type PreparedPrintfulDraft = {
  syncProductId: string
  title: string
  slug: string
  variants: { syncId: string; catalogId: string; sku: string; size: string; color: string }[]
}

export async function preparePrintfulDraft(productId: number): Promise<PreparedPrintfulDraft> {
  if (process.env.PRINTFUL_STORE_ID !== STORE_ID) throw new Error('STORE_NOT_VERIFIED')
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('TOKEN_NOT_CONFIGURED')
  const detail = await getPrintfulProductDetail(productId)
  if ('error' in detail) throw new Error('PRINTFUL_DETAIL_FAILED')
  if (detail.variants.length < 1 || detail.variants.length > 100) throw new Error('INVALID_VARIANT_COUNT')
  const seenSkus = new Set<string>()
  const seenDimensions = new Set<string>()
  const variants = []
  for (const item of detail.variants) {
    if (!item.synced || !item.catalogId || !Number.isSafeInteger(item.catalogId) || !item.sku) throw new Error('UNCONFIGURED_VARIANT')
    const res = await fetch(`https://api.printful.com/products/variant/${item.catalogId}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-PF-Store-Id': STORE_ID, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store'
    })
    if (!res.ok) throw new Error('CATALOG_UNAVAILABLE')
    const body: unknown = await res.json()
    if (!body || typeof body !== 'object') throw new Error('INVALID_CATALOG_RESPONSE')
    const payload = body as Record<string, unknown>
    if (payload.code !== 200 || !payload.result || typeof payload.result !== 'object') throw new Error('INVALID_CATALOG_RESPONSE')
    const row = (payload.result as Record<string, unknown>).variant
    if (!row || typeof row !== 'object') throw new Error('INVALID_CATALOG_VARIANT')
    const catalog = row as Record<string, unknown>
    if (catalog.id !== item.catalogId || typeof catalog.size !== 'string' || typeof catalog.color !== 'string') throw new Error('INVALID_CATALOG_VARIANT')
    const size = catalog.size.trim().toUpperCase()
    const color = catalog.color.trim().toUpperCase().replace(/\s+/g, '-')
    const sku = item.sku.trim().toUpperCase()
    if (!option.test(size) || !option.test(color) || !skuPattern.test(sku)) throw new Error('INVALID_VARIANT_DIMENSIONS')
    if (seenSkus.has(sku) || seenDimensions.has(`${size}|${color}`)) throw new Error('DUPLICATE_VARIANTS')
    seenSkus.add(sku)
    seenDimensions.add(`${size}|${color}`)
    variants.push({ syncId: String(item.syncId), catalogId: String(item.catalogId), sku, size, color })
  }
  return { syncProductId: String(detail.id), title: detail.name.trim().slice(0, 120), slug: `printful-${detail.id}`, variants }
}
