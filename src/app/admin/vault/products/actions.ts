'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { normalizeCurrency, parseSupportedCurrency } from '@/lib/currency'
import type { VaultActionState, VaultKind, ProductMode } from '@/lib/admin-vault-validation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const keys = ['kind','category_id','name','slug','short_description','description','product_mode','price','currency','cover_image_url','sort_order','seo_title','seo_description','author_name','isbn','page_count','physical_weight_g','preview_text','instructor_id','subtitle','level','duration_minutes','preview_video_url']
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const nullable = (value: string) => value || null
const fail = (error: string, data: FormData): VaultActionState => ({ error, fields: Object.fromEntries(keys.map(key => [key, text(data, key)])) })
const validUrl = (value: string) => { if (!value) return true; try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }
const positiveInteger = (value: string) => !value || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0)

async function mutate(id: string | null, data: FormData): Promise<VaultActionState> {
  await requireAdmin()
  const supabase = await createClient()
  const kind = text(data, 'kind') as VaultKind
  const categoryId = text(data, 'category_id')
  const mode = text(data, 'product_mode') as ProductMode
  const name = text(data, 'name'), slug = text(data, 'slug').toLowerCase()
  const priceRaw = text(data, 'price'), sortRaw = text(data, 'sort_order') || '0'
  const currency = parseSupportedCurrency(normalizeCurrency(data.get('currency')))
  if (!name) return fail('Name is required.', data)
  if (!SLUG.test(slug) || slug.length > 160) return fail('Use a lowercase slug with words separated by hyphens.', data)
  if (!['book', 'course'].includes(kind)) return fail('Choose Book or Course.', data)
  if (!categoryId || !UUID.test(categoryId)) return fail('Choose a valid category.', data)
  if (!['digital', 'physical', 'hybrid'].includes(mode)) return fail('Choose a valid product mode.', data)
  if (!currency) return fail('Choose a supported currency.', data)
  if (!priceRaw || !/^\d+(?:\.\d{1,2})?$/.test(priceRaw) || Number(priceRaw) < 0) return fail('Price must be zero or a positive amount with at most two decimal places.', data)
  if (currency === 'JPY' && !/^\d+$/.test(priceRaw)) return fail('JPY prices must be whole yen amounts.', data)
  if (!/^-?\d+$/.test(sortRaw) || !Number.isSafeInteger(Number(sortRaw))) return fail('Sort order must be a whole number.', data)
  if (!validUrl(text(data, 'cover_image_url'))) return fail('Cover image URL must be an absolute HTTP or HTTPS URL.', data)
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
  if (id) {
    if (!UUID.test(id)) return fail('This product is invalid.', data)
    const existing = await supabase.from('evo_vault_products').select('kind,category_id').eq('id', id).maybeSingle()
    if (existing.error || !existing.data) return fail('This product is unavailable.', data)
    if (existing.data.kind !== kind) return fail('Product kind cannot be changed after creation.', data)
    existingCategoryId = existing.data.category_id
  }
  const category = await supabase.from('evo_vault_categories').select('id,is_active').eq('id', categoryId).maybeSingle()
  if (category.error || !category.data) return fail('The selected category is unavailable.', data)
  if (!category.data.is_active && existingCategoryId !== categoryId) return fail('Choose an active category. An inactive category may only be retained by a product already assigned to it.', data)
  const parent = { kind, category_id: categoryId, name, slug, short_description: nullable(text(data,'short_description')), description: nullable(text(data,'description')), product_mode: mode, price: Number(priceRaw), currency, cover_image_url: nullable(text(data,'cover_image_url')), is_active: data.get('is_active') === 'on', is_featured: data.get('is_featured') === 'on', sort_order: Number(sortRaw), seo_title: nullable(text(data,'seo_title')), seo_description: nullable(text(data,'seo_description')) }
  const subtype = kind === 'book'
    ? { author_name: nullable(text(data,'author_name')), isbn: nullable(text(data,'isbn')), page_count: text(data,'page_count') ? Number(text(data,'page_count')) : null, physical_weight_g: text(data,'physical_weight_g') ? Number(text(data,'physical_weight_g')) : null, preview_text: nullable(text(data,'preview_text')) }
    : { instructor_id: nullable(instructorId), subtitle: nullable(text(data,'subtitle')), level: nullable(text(data,'level')), duration_minutes: text(data,'duration_minutes') ? Number(text(data,'duration_minutes')) : null, certificate_available: data.get('certificate_available') === 'on', preview_video_url: nullable(text(data,'preview_video_url')) }
  const result = await supabase.rpc('save_evo_vault_product', { p_product_id: id, p_parent: parent, p_subtype: subtype })
  if (result.error || !result.data) return fail(result.error?.code === '23505' ? 'That slug is already in use.' : 'The product could not be saved. No partial changes were kept.', data)
  const savedId = String(result.data)
  revalidatePath('/admin/vault'); revalidatePath('/admin/vault/products'); revalidatePath(`/admin/vault/products/${savedId}/edit`)
  redirect(`/admin/vault/products/${savedId}/edit?success=saved`)
}

export async function createVaultProductAction(_state: VaultActionState, data: FormData) { return mutate(null, data) }
export async function updateVaultProductAction(id: string, _state: VaultActionState, data: FormData) { return mutate(id, data) }
