import 'server-only'
import { getPrintfulProductDetail } from './product-detail'

const SYNC_PRODUCT = 479728769
const EXPECTED_VARIANTS = 18

export type PlacementSummary = { placement: string; fileCount: number; configuredFileIds: number; unresolvedFileIds: number }
export type ProductionVariantSummary = {
  syncVariantId: number; catalogVariantId: number | null; sku: string | null
  synced: boolean; productionFiles: number; placements: PlacementSummary[]
  evidence: 'FILES_PRESENT' | 'NO_FILES_REPORTED' | 'CONFIGURATION_UNKNOWN'
}
export type ProductionConfigurationResult =
  | { ok: true; productId: number; variantCount: number; variants: ProductionVariantSummary[]; note: string }
  | { ok: false; code: 'TOKEN_NOT_CONFIGURED' | 'PRODUCT_UNAVAILABLE' | 'INVALID_RESPONSE' }

export function parseProductionConfiguration(payload: unknown): ProductionConfigurationResult {
  if (!payload || typeof payload !== 'object') return { ok: false, code: 'INVALID_RESPONSE' }
  const root = payload as Record<string, unknown>
  if (root.code !== 200 || !root.result || typeof root.result !== 'object') return { ok: false, code: 'INVALID_RESPONSE' }
  const result = root.result as Record<string, unknown>
  if (!result.sync_product || typeof result.sync_product !== 'object' || !Array.isArray(result.sync_variants)) return { ok: false, code: 'INVALID_RESPONSE' }
  if ((result.sync_product as Record<string,unknown>).id !== SYNC_PRODUCT || result.sync_variants.length !== EXPECTED_VARIANTS) return { ok: false, code: 'INVALID_RESPONSE' }
  const ids = new Set<number>()
  const variants: ProductionVariantSummary[] = []
  for (const item of result.sync_variants) {
    if (!item || typeof item !== 'object') return { ok: false, code: 'INVALID_RESPONSE' }
    const row = item as Record<string,unknown>
    const id = row.id
    if (!Number.isSafeInteger(id) || (id as number) <= 0 || ids.has(id as number) ||
      (row.variant_id !== null && row.variant_id !== undefined && (!Number.isSafeInteger(row.variant_id) || (row.variant_id as number) <= 0)))
      return { ok: false, code: 'INVALID_RESPONSE' }
    ids.add(id as number)
    const files = row.files
    if (files !== undefined && files !== null && !Array.isArray(files)) return { ok: false, code: 'INVALID_RESPONSE' }
    const placements = new Map<string,PlacementSummary>()
    if (Array.isArray(files)) {
      if (files.length > 20) return { ok: false, code: 'INVALID_RESPONSE' }
      for (const f of files) {
        if (!f || typeof f !== 'object') return { ok: false, code: 'INVALID_RESPONSE' }
        const file = f as Record<string,unknown>
        const raw = typeof file.type === 'string' ? file.type : 'unspecified'
        const placement = /^[a-z0-9_-]{1,40}$/i.test(raw) ? raw : 'unrecognized'
        const validId = Number.isSafeInteger(file.id) && (file.id as number) > 0
        const existing = placements.get(placement) ?? { placement, fileCount: 0, configuredFileIds: 0, unresolvedFileIds: 0 }
        existing.fileCount++
        if (validId) existing.configuredFileIds++
        else existing.unresolvedFileIds++
        placements.set(placement, existing)
      }
    }
    variants.push({
      syncVariantId: id as number,
      catalogVariantId: typeof row.variant_id === 'number' ? row.variant_id : null,
      sku: typeof row.sku === 'string' ? row.sku.slice(0,64) : null,
      synced: row.synced === true,
      productionFiles: Array.isArray(files) ? files.length : 0,
      placements: Array.from(placements.values()),
      evidence: !Array.isArray(files) ? 'CONFIGURATION_UNKNOWN' : files.length ? 'FILES_PRESENT' : 'NO_FILES_REPORTED',
    })
  }
  return { ok: true, productId: SYNC_PRODUCT, variantCount: variants.length, variants,
    note: 'Provider file IDs/placements are metadata only: presence does not prove correct artwork, print placement, licensing, or production-cost estimation readiness. No file URLs or artwork bytes are exposed.' }
}

export async function inspectPrintfulProductionConfiguration(): Promise<ProductionConfigurationResult> {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) return { ok: false, code: 'TOKEN_NOT_CONFIGURED' }
  try {
    // Existing provider GET permission only. No write endpoints or artwork downloads.
    const response = await fetch('https://api.printful.com/store/products/479728769', {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, 'X-PF-Store-Id': '18878485', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error',
    })
    if (!response.ok) return { ok: false, code: 'PRODUCT_UNAVAILABLE' }
    return parseProductionConfiguration(await response.json())
  } catch { return { ok: false, code: 'PRODUCT_UNAVAILABLE' } }
}
