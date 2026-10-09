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
    const allowed = ['STORE_NOT_VERIFIED','TOKEN_NOT_CONFIGURED','PRINTFUL_DETAIL_FAILED','INVALID_VARIANT_COUNT',
      'UNCONFIGURED_VARIANT','CATALOG_UNAVAILABLE','INVALID_CATALOG_RESPONSE','INVALID_CATALOG_VARIANT',
      'INVALID_VARIANT_DIMENSIONS','DUPLICATE_VARIANTS']
    return { ready: false, variantCount: 0, code: allowed.includes(known) ? known : 'PREFLIGHT_FAILED' }
  }
}
