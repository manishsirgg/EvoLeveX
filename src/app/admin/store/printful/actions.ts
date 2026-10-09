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
