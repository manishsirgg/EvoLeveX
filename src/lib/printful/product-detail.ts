import 'server-only'

const MAX_VARIANTS = 100
type Variant = { syncId: number; catalogId: number | null; name: string; sku: string | null; retailPrice: string | null; synced: boolean }
export type ProductDetail = { id: number; name: string; variants: Variant[]; error?: never }
export type ProductDetailResult = ProductDetail | { error: 'NOT_CONFIGURED' | 'INVALID_ID' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE' }

export function parsePrintfulProductDetail(input: unknown): ProductDetail {
  if (!input || typeof input !== 'object') throw new Error('INVALID_RESPONSE')
  const body = input as Record<string, unknown>
  if (body.code !== 200 || !body.result || typeof body.result !== 'object') throw new Error('INVALID_RESPONSE')
  const result = body.result as Record<string, unknown>
  const product = result.sync_product
  if (!product || typeof product !== 'object' || !Array.isArray(result.sync_variants) || result.sync_variants.length > MAX_VARIANTS) throw new Error('INVALID_RESPONSE')
  const info = product as Record<string, unknown>
  if (!Number.isSafeInteger(info.id) || typeof info.name !== 'string') throw new Error('INVALID_RESPONSE')
  const variants: Variant[] = result.sync_variants.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('INVALID_RESPONSE')
    const row = value as Record<string, unknown>
    if (!Number.isSafeInteger(row.id) || typeof row.name !== 'string') throw new Error('INVALID_RESPONSE')
    return {
      syncId: row.id as number,
      catalogId: Number.isSafeInteger(row.variant_id) ? row.variant_id as number : null,
      name: row.name.slice(0, 160),
      sku: typeof row.sku === 'string' ? row.sku.slice(0, 64) : null,
      retailPrice: typeof row.retail_price === 'string' ? row.retail_price.slice(0, 32) : null,
      synced: row.synced === true,
    }
  })
  return { id: info.id as number, name: info.name.slice(0, 160), variants }
}

export async function getPrintfulProductDetail(id: number): Promise<ProductDetailResult> {
  if (!Number.isSafeInteger(id) || id <= 0) return { error: 'INVALID_ID' }
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) return { error: 'NOT_CONFIGURED' }
  try {
    const response = await fetch(`https://api.printful.com/store/products/${id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'X-PF-Store-Id': '18878485', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
      redirect: 'error',
    })
    if (!response.ok) return { error: 'UPSTREAM_ERROR' }
    return parsePrintfulProductDetail(await response.json())
  } catch {
    return { error: 'INVALID_RESPONSE' }
  }
}
