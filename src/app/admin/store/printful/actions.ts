'use server'

import { requireAdmin } from '@/lib/admin-auth'
import { probePrintfulConnection } from '@/lib/printful/read-only'

export async function checkPrintfulConnection() {
  await requireAdmin()
  return probePrintfulConnection()
}

import { getPrintfulProductDetail } from '@/lib/printful/product-detail'

export async function previewPrintfulProduct(id: number) {
  await requireAdmin()
  return getPrintfulProductDetail(id)
}

import { preparePrintfulDraft } from '@/lib/printful/prepare-import'
import { createClient } from '@/lib/supabase/server'

// Fail closed until explicit, separately reviewed launch authorization.
// This function re-fetches all provider data server-side: no client-supplied variant payload.
export async function importPrintfulDraft(productId: number): Promise<{ productId?: string; error?: string }> {
  await requireAdmin()
  if (process.env.PRINTFUL_IMPORT_ENABLED !== 'true') return { error: 'IMPORT_DISABLED' }
  if (!Number.isSafeInteger(productId) || productId <= 0) return { error: 'INVALID_PRODUCT' }
  try {
    const prepared = await preparePrintfulDraft(productId)
    const supabase = await createClient()
    const { data: category, error: categoryError } = await supabase.from('evo_store_categories')
      .select('id,parent_id,is_active').eq('slug','t-shirts').eq('is_active',true).maybeSingle()
    if (categoryError || !category?.parent_id) return { error: 'CATEGORY_UNAVAILABLE' }
    const { data: parent } = await supabase.from('evo_store_categories')
      .select('slug,is_active').eq('id', category.parent_id).maybeSingle()
    if (!parent || parent.slug !== 'fashion' || !parent.is_active) return { error: 'CATEGORY_UNAVAILABLE' }
    const { data, error } = await supabase.rpc('import_evo_store_printful_draft', {
      p_store_external_id: '18878485',
      p_category_id: category.id,
      p_product: prepared,
    })
    if (error || typeof data !== 'string') return { error: 'IMPORT_FAILED' }
    return { productId: data }
  } catch {
    return { error: 'IMPORT_VALIDATION_FAILED' }
  }
}

export async function checkPrintfulImportReadiness(productId: number): Promise<{
  ready: boolean; variantCount: number; code: string
}> {
  await requireAdmin()
  if (!Number.isSafeInteger(productId) || productId <= 0) return { ready: false, variantCount: 0, code: 'INVALID_PRODUCT' }
  try {
    const prepared = await preparePrintfulDraft(productId)
    const supabase = await createClient()
    const { data: category, error } = await supabase.from('evo_store_categories')
      .select('id,parent_id,is_active').eq('slug', 't-shirts').eq('is_active', true).maybeSingle()
    if (error || !category?.parent_id) return { ready: false, variantCount: 0, code: 'CATEGORY_UNAVAILABLE' }
    const { data: parent, error: parentError } = await supabase.from('evo_store_categories')
      .select('id').eq('id', category.parent_id).eq('slug', 'fashion').eq('is_active', true).maybeSingle()
    if (parentError || !parent) return { ready: false, variantCount: 0, code: 'CATEGORY_UNAVAILABLE' }
    // Readiness is advisory. The database validates duplicates and permissions atomically.
    return { ready: true, variantCount: prepared.variants.length, code: 'VARIANTS_VALIDATED' }
  } catch (cause) {
    const known = cause instanceof Error ? cause.message : ''
    const allowed = ['STORE_NOT_VERIFIED','STORE_IDENTITY_UNVERIFIED','TOKEN_NOT_CONFIGURED','PRINTFUL_DETAIL_FAILED','INVALID_VARIANT_COUNT',
      'UNCONFIGURED_VARIANT','CATALOG_UNAVAILABLE','INVALID_CATALOG_RESPONSE','INVALID_CATALOG_VARIANT',
      'INVALID_VARIANT_DIMENSIONS','DUPLICATE_VARIANTS']
    return { ready: false, variantCount: 0, code: allowed.includes(known) ? known : 'PREFLIGHT_FAILED' }
  }
}

import { previewPrintfulMedia } from '@/lib/printful/media-preview'

export async function inspectPrintfulMedia(id: number) {
  await requireAdmin()
  return previewPrintfulMedia(id)
}

import { stagePrintfulMockupGallery } from '@/lib/printful/mockup-gallery-stage'

export async function previewStagedPrintfulGallery(id: number) {
  await requireAdmin()
  return stagePrintfulMockupGallery(id)
}

import { fetchValidatedPrintfulPng } from '@/lib/printful/mockup-ingestion-validate'

export async function verifyPrintfulMockupBytes(productId: number, fileId: number): Promise<
  { valid: true; fileId: number; width: number; height: number; bytes: number } |
  { valid: false; code: string }
> {
  await requireAdmin()
  if (!Number.isSafeInteger(fileId)) return { valid: false, code: 'INVALID_FILE' }
  try {
    const gallery = await stagePrintfulMockupGallery(productId)
    if (!gallery.ready) return { valid: false, code: 'GALLERY_NOT_READY' }
    const selected = gallery.mockups.find(file => file.fileId === fileId)
    if (!selected) return { valid: false, code: 'FILE_NOT_APPROVED' }
    const image = await fetchValidatedPrintfulPng(selected.providerUrl)
    return { valid: true, fileId, width: image.width, height: image.height, bytes: image.bytes.length }
  } catch {
    return { valid: false, code: 'IMAGE_VALIDATION_FAILED' }
  }
}

import { printfulMockupStoragePath } from '@/lib/printful/mockup-storage-path'
import { decodeApprovedPrintfulMockup } from '@/lib/printful/mockup-decode'

const LOCAL_MOCKUP_PRODUCT_ID = '1dc06ef8-9a2e-419f-9bc3-d3ec06c476e0'

// Intentionally not exposed in any page or UI. Enable only after migration, test
// verification and an explicitly authorized, controlled first upload.
export async function uploadApprovedPrintfulMockup(productId: number, fileId: number):
  Promise<{ ok: true; fileId: number } | { ok: false; code: string }> {
  await requireAdmin()
  if (process.env.PRINTFUL_MEDIA_UPLOAD_ENABLED !== 'true') return { ok: false, code: 'UPLOAD_DISABLED' }
  if (productId !== 479728769 || !Number.isSafeInteger(fileId)) return { ok: false, code: 'NOT_APPROVED' }
  const gallery = await stagePrintfulMockupGallery(productId)
  if (!gallery.ready) return { ok: false, code: 'GALLERY_NOT_READY' }
  const candidate = gallery.mockups.find(item => item.fileId === fileId)
  if (!candidate) return { ok: false, code: 'FILE_NOT_APPROVED' }

  // Fetch and decode fully before touching database metadata.
  let png: Uint8Array
  try { png = await decodeApprovedPrintfulMockup(candidate.providerUrl) }
  catch { return { ok: false, code: 'INVALID_IMAGE_BYTES' } }

  const db = await createClient()
  const path = printfulMockupStoragePath(LOCAL_MOCKUP_PRODUCT_ID, fileId)
  const { error: reservationError } = await db.rpc('reserve_evo_store_printful_mockup', {
    p_product_id: LOCAL_MOCKUP_PRODUCT_ID, p_printful_file_id: fileId,
    p_color_code: candidate.color, p_storage_path: path, p_sort_order: candidate.sortOrder,
    p_alt_text: `EvoLeveX Short Sleeve T-shirt, ${candidate.label}`,
  })
  if (reservationError) return { ok: false, code: 'RESERVATION_FAILED' }

  // No overwrite. On error, don't delete unknown preexisting Storage objects.
  // A pending reservation needs explicit investigation/reconciliation.
  let result
  try {
    result = await db.storage.from('evo-store-products').upload(path, png, {
      contentType: 'image/png', cacheControl: '3600', upsert: false,
    })
  } catch { return { ok: false, code: 'RECONCILIATION_REQUIRED' } }
  if (result.error) return { ok: false, code: 'RECONCILIATION_REQUIRED' }

  const { error: finalizeError } = await db.rpc('complete_evo_store_printful_mockup', {
    p_product_id: LOCAL_MOCKUP_PRODUCT_ID, p_printful_file_id: fileId, p_storage_path: path,
  })
  if (finalizeError) return { ok: false, code: 'RECONCILIATION_REQUIRED' }
  return { ok: true, fileId }
}
