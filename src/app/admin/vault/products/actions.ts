'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { normalizeCurrency, parseSupportedCurrency } from '@/lib/currency'
import { hasValidImageSignature, validatedImageExtension } from '@/lib/public-image-upload'
import { VAULT_COVER_BUCKET, VAULT_COVER_MAX_BYTES, ownedVaultCoverPath } from '@/lib/vault-cover-image'
import type { VaultActionState, VaultKind, ProductMode } from '@/lib/admin-vault-validation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const keys = ['kind','category_id','name','slug','short_description','description','product_mode','price','currency','cover_image_url','sort_order','seo_title','seo_description','author_name','isbn','page_count','physical_weight_g','preview_text','instructor_id','subtitle','level','duration_minutes','preview_video_url']
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const nullable = (value: string) => value || null
const fail = (error: string, data: FormData): VaultActionState => ({ error, fields: Object.fromEntries(keys.map(key => [key, text(data, key)])) })
const validUrl = (value: string) => { if (!value) return true; try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }
const positiveInteger = (value: string) => !value || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0)

type CoverIntent = 'keep' | 'upload' | 'remove' | 'url'

async function validateCover(data: FormData) {
  const intent = text(data, 'cover_intent') as CoverIntent
  if (!['keep', 'upload', 'remove', 'url'].includes(intent)) return { error: 'Choose a valid cover image option.' }
  const file = data.get('cover_image')
  // A supplied file always wins, even if a tampered request also submits an external URL intent.
  if (file instanceof File && file.size > 0) {
    if (file.size > VAULT_COVER_MAX_BYTES) return { error: 'Cover images must be 5 MB or smaller.' }
    const extension = validatedImageExtension(file)
    if (!extension || !(await hasValidImageSignature(file, extension))) return { error: 'Choose a valid JPG, PNG, or WebP cover image.' }
    return { intent: 'upload' as const, file, extension }
  }
  if (intent === 'upload') return { error: 'Choose a cover image to upload.' }
  return { intent }
}

async function removeOwnedCover(supabase: Awaited<ReturnType<typeof createClient>>, url: string | null, productId: string) {
  const path = ownedVaultCoverPath(url, productId)
  if (!path) return true
  const result = await supabase.storage.from(VAULT_COVER_BUCKET).remove([path])
  return !result.error
}

async function mutate(id: string | null, data: FormData): Promise<VaultActionState> {
  await requireAdmin()
  const supabase = await createClient()
  const kind = text(data, 'kind') as VaultKind
  const categoryId = text(data, 'category_id')
  const mode = text(data, 'product_mode') as ProductMode
  const name = text(data, 'name'), slug = text(data, 'slug').toLowerCase()
  const priceRaw = text(data, 'price'), sortRaw = text(data, 'sort_order') || '0'
  const currency = parseSupportedCurrency(normalizeCurrency(data.get('currency')))
  const cover = await validateCover(data)
  if (cover.error) return fail(cover.error, data)
  const externalCoverUrl = text(data, 'cover_image_url')
  if (!name) return fail('Name is required.', data)
  if (!SLUG.test(slug) || slug.length > 160) return fail('Use a lowercase slug with words separated by hyphens.', data)
  if (!['book', 'course'].includes(kind)) return fail('Choose Book or Course.', data)
  if (!categoryId || !UUID.test(categoryId)) return fail('Choose a valid category.', data)
  if (!['digital', 'physical', 'hybrid'].includes(mode)) return fail('Choose a valid product mode.', data)
  if (!currency) return fail('Choose a supported currency.', data)
  if (!priceRaw || !/^\d+(?:\.\d{1,2})?$/.test(priceRaw) || Number(priceRaw) < 0) return fail('Price must be zero or a positive amount with at most two decimal places.', data)
  if (currency === 'JPY' && !/^\d+$/.test(priceRaw)) return fail('JPY prices must be whole yen amounts.', data)
  if (!/^-?\d+$/.test(sortRaw) || !Number.isSafeInteger(Number(sortRaw))) return fail('Sort order must be a whole number.', data)
  if (cover.intent === 'url' && externalCoverUrl && !validUrl(externalCoverUrl)) return fail('Cover image URL must be an absolute HTTP or HTTPS URL.', data)
  if (!positiveInteger(text(data, 'page_count'))) return fail('Page count must be a positive whole number.', data)
  if (!positiveInteger(text(data, 'physical_weight_g'))) return fail('Physical weight must be a positive whole number.', data)
  if (!positiveInteger(text(data, 'duration_minutes'))) return fail('Duration must be a positive whole number.', data)
  if (!validUrl(text(data, 'preview_video_url'))) return fail('Preview video URL must be an absolute HTTP or HTTPS URL.', data)
  const instructorId = text(data, 'instructor_id')
  if (kind === 'course' && instructorId) {
    if (!UUID.test(instructorId)) return fail('Choose a valid instructor.', data)
    const profile = await supabase.from('profiles').select('id').eq('id', instructorId).maybeSingle()
    if (profile.error || !profile.data) return fail('The selected instructor is unavailable.', data)
  }
  let existingCategoryId: string | null = null
  let existingCoverUrl: string | null = null
  if (id) {
    if (!UUID.test(id)) return fail('This product is invalid.', data)
    const existing = await supabase.from('evo_vault_products').select('kind,category_id,cover_image_url').eq('id', id).maybeSingle()
    if (existing.error || !existing.data) return fail('This product is unavailable.', data)
    if (existing.data.kind !== kind) return fail('Product kind cannot be changed after creation.', data)
    existingCategoryId = existing.data.category_id
    existingCoverUrl = existing.data.cover_image_url
  }
  const category = await supabase.from('evo_vault_categories').select('id,is_active').eq('id', categoryId).maybeSingle()
  if (category.error || !category.data) return fail('The selected category is unavailable.', data)
  if (!category.data.is_active && existingCategoryId !== categoryId) return fail('Choose an active category. An inactive category may only be retained by a product already assigned to it.', data)
  const requestedCoverUrl = cover.intent === 'remove'
    ? null
    : cover.intent === 'url' && externalCoverUrl
      ? externalCoverUrl
      : existingCoverUrl
  const parent = { kind, category_id: categoryId, name, slug, short_description: nullable(text(data,'short_description')), description: nullable(text(data,'description')), product_mode: mode, price: Number(priceRaw), currency, cover_image_url: requestedCoverUrl, is_active: data.get('is_active') === 'on', is_featured: data.get('is_featured') === 'on', sort_order: Number(sortRaw), seo_title: nullable(text(data,'seo_title')), seo_description: nullable(text(data,'seo_description')) }
  const subtype = kind === 'book'
    ? { author_name: nullable(text(data,'author_name')), isbn: nullable(text(data,'isbn')), page_count: text(data,'page_count') ? Number(text(data,'page_count')) : null, physical_weight_g: text(data,'physical_weight_g') ? Number(text(data,'physical_weight_g')) : null, preview_text: nullable(text(data,'preview_text')) }
    : { instructor_id: nullable(instructorId), subtitle: nullable(text(data,'subtitle')), level: nullable(text(data,'level')), duration_minutes: text(data,'duration_minutes') ? Number(text(data,'duration_minutes')) : null, certificate_available: data.get('certificate_available') === 'on', preview_video_url: nullable(text(data,'preview_video_url')) }
  const result = await supabase.rpc('save_evo_vault_product', { p_product_id: id, p_parent: parent, p_subtype: subtype })
  if (result.error || !result.data) return fail(result.error?.code === '23505' ? 'That slug is already in use.' : 'The product could not be saved. No partial changes were kept.', data)
  const savedId = String(result.data)
  let finalCoverUrl = requestedCoverUrl
  let uploadedPath: string | null = null
  if (cover.intent === 'upload' && cover.file && cover.extension) {
    uploadedPath = `vault/${savedId}/cover/${crypto.randomUUID()}.${cover.extension}`
    const upload = await supabase.storage.from(VAULT_COVER_BUCKET).upload(uploadedPath, cover.file, {
      contentType: cover.file.type,
      upsert: false,
    })
    if (upload.error) {
      if (!id) redirect(`/admin/vault/products/${savedId}/edit?warning=${encodeURIComponent('Product saved without a cover because the image could not be uploaded. Select it again and retry.')}`)
      return fail('The cover image could not be uploaded. The existing cover was preserved; other product changes were saved.', data)
    }
    finalCoverUrl = supabase.storage.from(VAULT_COVER_BUCKET).getPublicUrl(uploadedPath).data.publicUrl
    const coverUpdate = await supabase.from('evo_vault_products').update({ cover_image_url: finalCoverUrl }).eq('id', savedId).select('id').single()
    if (coverUpdate.error || !coverUpdate.data) {
      await supabase.storage.from(VAULT_COVER_BUCKET).remove([uploadedPath])
      if (!id) redirect(`/admin/vault/products/${savedId}/edit?warning=${encodeURIComponent('Product saved without a cover because its uploaded image could not be attached. Select it again and retry.')}`)
      return fail('The cover image could not be attached. The uploaded file was removed and the existing cover was preserved; other product changes were saved.', data)
    }
  }

  let cleanupWarning = ''
  if (existingCoverUrl && existingCoverUrl !== finalCoverUrl && ['upload', 'remove', 'url'].includes(cover.intent ?? '')) {
    if (!(await removeOwnedCover(supabase, existingCoverUrl, savedId))) cleanupWarning = 'Product saved, but the previous managed cover could not be removed. Please try saving again or contact an administrator.'
  }
  revalidatePath('/admin/vault'); revalidatePath('/admin/vault/products'); revalidatePath(`/admin/vault/products/${savedId}/edit`)
  redirect(`/admin/vault/products/${savedId}/edit?success=saved${cleanupWarning ? `&warning=${encodeURIComponent(cleanupWarning)}` : ''}`)
}

export async function createVaultProductAction(_state: VaultActionState, data: FormData) { return mutate(null, data) }
export async function updateVaultProductAction(id: string, _state: VaultActionState, data: FormData) { return mutate(id, data) }
