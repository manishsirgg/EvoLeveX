import 'server-only'

import { getPrintfulProductDetail } from './product-detail'
import { previewPrintfulMedia } from './media-preview'
import { verifyPrintfulStoreIdentity } from './store-identity'

const HOODIE_SYNC_ID = 481420111
const STORE_ID = '18878485'

export type HoodiePreflight =
  | { ok: true; variantCount: number; mockupCount: number; mockups: { fileId: number; variantId: number; type: string }[]; prices: { syncId: number; sku: string | null; retailPrice: string | null; state: 'PRESENT_UNVERIFIED_CURRENCY' | 'MISSING' }[]; note: string }
  | { ok: false; code: string }

// Provider inspection is not a transfer or a statement of currency / image suitability.
// Never include provider URLs or artwork bytes in the client result.
export async function preflightHoodieMediaAndRetail(): Promise<HoodiePreflight> {
  if (process.env.PRINTFUL_STORE_ID !== STORE_ID || !(await verifyPrintfulStoreIdentity()))
    return { ok: false, code: 'STORE_NOT_VERIFIED' }
  const [detail, media] = await Promise.all([
    getPrintfulProductDetail(HOODIE_SYNC_ID), previewPrintfulMedia(HOODIE_SYNC_ID),
  ])
  if ('error' in detail || 'error' in media) return { ok: false, code: 'PROVIDER_UNAVAILABLE' }
  if (detail.id !== HOODIE_SYNC_ID || detail.variants.length !== 10 || media.inspectedVariants !== 10)
    return { ok: false, code: 'PRODUCT_OR_VARIANTS_CHANGED' }
  const ids = new Set(detail.variants.map(v => v.syncId))
  if (ids.size !== 10 || detail.variants.some(v => !v.synced))
    return { ok: false, code: 'UNCONFIGURED_VARIANTS' }
  const previews = media.candidates.filter(candidate => candidate.type === 'preview' &&
    ids.has(candidate.syncVariantId))
  const mockups = Array.from(new Map(previews.map(p => [p.fileId,p])).values()).map(m => ({
    fileId: m.fileId, variantId: m.syncVariantId, type: m.type,
  }))
  return { ok: true, variantCount: 10, mockupCount: mockups.length, mockups,
    prices: detail.variants.map(v => ({
      syncId: v.syncId, sku: v.sku, retailPrice: v.retailPrice,
      state: v.retailPrice && /^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(v.retailPrice) && Number(v.retailPrice) > 0
        ? 'PRESENT_UNVERIFIED_CURRENCY' as const : 'MISSING' as const,
    })),
    note: 'Read-only. Printful retail price fields do not independently establish currency. No merchant pricing or images are written to Evo Store.',
  }
}
