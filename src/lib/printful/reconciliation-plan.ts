import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getPrintfulProductDetail } from './product-detail'
import { previewPrintfulMedia } from './media-preview'
import { verifyPrintfulStoreIdentity } from './store-identity'

const STORE_ID = '18878485'
const MAX_VARIANTS = 100
const MAX_PREVIEWS = 30

type PlanRow = { variantId: string; syncVariantId: number; sku: string; color: string; amount: string; currency: 'USD' }
type PlanImage = { fileId: number; color: string; variantId: string; primaryCandidate: boolean }
export type ReconciliationPlan =
  | { ok: true; productId: string; syncProductId: number; prices: PlanRow[]; images: PlanImage[]; warnings: string[]; mode: 'PREVIEW_ONLY' }
  | { ok: false; code: string }

function amount(input: string | null): string | null {
  if (!input || !/^(?:0|[1-9]\d{0,5})\.\d{2}$/.test(input)) return null
  return Number(input) > 0 ? input : null
}
function normSku(value: string) { return value.trim().toUpperCase() }

// A generic, fail-closed mapping plan. This is deliberately read-only: provider
// retail currency is not present in the API response and needs merchant approval.
// Storage ingestion must later reuse atomic claim / verified-byte completion.
export async function planPrintfulReconciliation(
  productId: string, syncProductId: number, confirmedCurrency?: string,
): Promise<ReconciliationPlan> {
  if (process.env.PRINTFUL_STORE_ID !== STORE_ID || !(await verifyPrintfulStoreIdentity()))
    return { ok: false, code: 'STORE_NOT_VERIFIED' }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(productId) ||
      !Number.isSafeInteger(syncProductId) || syncProductId <= 0)
    return { ok: false, code: 'INVALID_INPUT' }
  if (confirmedCurrency !== 'USD') return { ok: false, code: 'CURRENCY_CONFIRMATION_REQUIRED' }
  const db = await createClient()
  const { data: product, error: productError } = await db.from('evo_store_products')
    .select('id,slug,publication_status,is_active')
    .eq('id',productId).maybeSingle()
  if (productError || !product || product.slug !== `printful-${syncProductId}` ||
      product.publication_status !== 'draft' || product.is_active)
    return { ok: false, code: 'PRODUCT_STATE_INVALID' }
  const { data: variants, error: variantsError } = await db.from('evo_store_variants')
    .select('id,sku,color_code,is_active').eq('product_id',productId).limit(MAX_VARIANTS+1)
  if (variantsError || !variants?.length || variants.length > MAX_VARIANTS ||
      variants.some(v => v.is_active || !v.sku || !v.color_code))
    return { ok: false, code: 'LOCAL_VARIANTS_INVALID' }
  const [detail, media] = await Promise.all([
    getPrintfulProductDetail(syncProductId), previewPrintfulMedia(syncProductId),
  ])
  if ('error' in detail || 'error' in media) return { ok: false, code: 'PROVIDER_UNAVAILABLE' }
  if (detail.id !== syncProductId || detail.variants.length !== variants.length ||
      media.inspectedVariants !== variants.length)
    return { ok: false, code: 'VARIANT_COUNT_CHANGED' }
  const bySku = new Map(variants.map(v=>[normSku(v.sku),v]))
  if (bySku.size !== variants.length) return { ok: false, code: 'DUPLICATE_LOCAL_SKU' }
  const prices: PlanRow[] = []
  const bySyncId = new Map<number, { variantId: string; color: string }>()
  for (const item of detail.variants) {
    if (!item.synced || !item.sku || !Number.isSafeInteger(item.syncId) || bySyncId.has(item.syncId))
      return { ok: false, code: 'INVALID_PROVIDER_VARIANT' }
    const local = bySku.get(normSku(item.sku))
    const value = amount(item.retailPrice)
    if (!local || !value) return { ok: false, code: 'SKU_OR_PRICE_MISMATCH' }
    prices.push({variantId:local.id,syncVariantId:item.syncId,sku:item.sku,
      color:local.color_code,amount:value,currency:'USD'})
    bySyncId.set(item.syncId,{variantId:local.id,color:local.color_code})
  }
  if (prices.length !== variants.length || new Set(prices.map(p=>p.variantId)).size !== variants.length)
    return { ok: false, code: 'INCOMPLETE_VARIANT_MATCH' }
  const uniqueFiles = new Map<number, PlanImage>()
  for (const candidate of media.candidates) {
    if (candidate.type !== 'preview') continue
    const local = bySyncId.get(candidate.syncVariantId)
    if (!local) return { ok: false, code: 'UNKNOWN_MEDIA_VARIANT' }
    const existing = uniqueFiles.get(candidate.fileId)
    if (existing && existing.color !== local.color) return { ok: false, code: 'AMBIGUOUS_IMAGE_COLOR' }
    if (!existing) uniqueFiles.set(candidate.fileId,{fileId:candidate.fileId,
      color:local.color,variantId:local.variantId,primaryCandidate:false})
  }
  if (!uniqueFiles.size || uniqueFiles.size > MAX_PREVIEWS)
    return { ok: false, code: 'MEDIA_INCOMPLETE' }
  const images = [...uniqueFiles.values()].sort((a,b)=>a.color.localeCompare(b.color))
  images[0].primaryCandidate = true
  return {ok:true,productId,syncProductId,prices,images,mode:'PREVIEW_ONLY',
    warnings:['USD is merchant-confirmed, not supplied in the Printful variant API response.',
      'No prices or media have been written. Existing product images and prices must be reconciled before writing.',
      'Images are provider preview file IDs only; bytes and format must be verified before Supabase Storage transfer.']}
}
