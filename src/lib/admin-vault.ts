import { createClient } from '@/lib/supabase/server'
import { isSupportedCurrency, type SupportedCurrency } from './currency'
import type { ProductMode, VaultKind } from './admin-vault-validation'

export type VaultProduct = {
  id: string; kind: VaultKind; category_id: string; name: string; slug: string; description: string | null
  short_description: string | null; product_mode: ProductMode; price: number | string
  currency: SupportedCurrency; cover_image_url: string | null; is_active: boolean; is_featured: boolean
  sort_order: number; seo_title: string | null; seo_description: string | null; created_at: string
}
export type VaultCategory = { id: string; name: string; slug: string; description: string | null; image_url: string | null; sort_order: number; is_active: boolean }
export type VaultBook = { author_name: string | null; isbn: string | null; page_count: number | null; physical_weight_g: number | null; preview_text: string | null }
export type VaultCourse = { instructor_id: string | null; subtitle: string | null; level: string | null; duration_minutes: number | null; certificate_available: boolean; preview_video_url: string | null }
export type Instructor = { id: string; label: string }

const productFields = 'id,kind,category_id,name,slug,description,short_description,product_mode,price,currency,cover_image_url,is_active,is_featured,sort_order,seo_title,seo_description,created_at'

export async function getVaultProducts() {
  const supabase = await createClient()
  const result = await supabase.from('evo_vault_products').select(`${productFields},category:evo_vault_categories(name)`).order('sort_order').order('created_at', { ascending: false }).order('id')
  const products = (result.data ?? []).filter((product) => isSupportedCurrency(product.currency)) as unknown as (VaultProduct & { category: { name: string } | null })[]
  return { products, hasError: Boolean(result.error) || products.length !== (result.data?.length ?? 0) }
}

export async function getVaultCategories(selectedId?: string | null, includeInactive = false) {
  const supabase = await createClient()
  const result = await supabase.from('evo_vault_categories').select('id,name,slug,description,image_url,sort_order,is_active').order('sort_order').order('name').order('id')
  if (result.error) return { categories: [] as VaultCategory[], hasError: true }
  const rows = (result.data ?? []) as VaultCategory[]
  const categories = rows.filter(category => includeInactive || category.is_active || category.id === selectedId)
  return { categories, hasError: Boolean(selectedId && !categories.some(category => category.id === selectedId)) }
}

export async function getVaultStats() {
  const supabase = await createClient()
  const result = await supabase.from('evo_vault_products').select('kind,is_active,is_featured')
  if (result.error) return null
  const rows = result.data ?? []
  return { total: rows.length, active: rows.filter(x => x.is_active).length, books: rows.filter(x => x.kind === 'book').length, courses: rows.filter(x => x.kind === 'course').length, featured: rows.filter(x => x.is_featured).length }
}

export async function getVaultProduct(id: string) {
  const supabase = await createClient()
  const parent = await supabase.from('evo_vault_products').select(productFields).eq('id', id).maybeSingle()
  if (parent.error || !parent.data) return null
  if (!isSupportedCurrency(parent.data.currency)) return null
  const product = parent.data as VaultProduct
  const subtype = product.kind === 'book'
    ? await supabase.from('evo_vault_books').select('author_name,isbn,page_count,physical_weight_g,preview_text').eq('vault_product_id', id).maybeSingle()
    : await supabase.from('evo_vault_courses').select('instructor_id,subtitle,level,duration_minutes,certificate_available,preview_video_url').eq('vault_product_id', id).maybeSingle()
  if (subtype.error || !subtype.data) return null
  return { product, book: product.kind === 'book' ? subtype.data as VaultBook : null, course: product.kind === 'course' ? subtype.data as VaultCourse : null }
}

export async function getVaultInstructors(selectedId?: string | null) {
  const supabase = await createClient()
  const result = await supabase.from('profiles').select('id,display_name,username').order('display_name').order('username')
  if (result.error) return { instructors: [] as Instructor[], hasError: true }
  const instructors = (result.data ?? []).map(x => ({ id: x.id, label: x.display_name?.trim() || (x.username ? `@${x.username}` : 'Unnamed profile') }))
  return { instructors, hasError: Boolean(selectedId && !instructors.some(x => x.id === selectedId)) }
}
