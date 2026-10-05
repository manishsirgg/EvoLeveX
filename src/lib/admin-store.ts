import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type StorePublicationStatus = 'draft' | 'published' | 'archived'

export type StoreAdminOverview = {
  categories: number
  products: number
  draft: number
  published: number
  archived: number
}

export type StoreAdminCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export type StoreAdminCategoryListItem = StoreAdminCategory & { product_count: number }

export type StoreAdminCategoryOption = Pick<StoreAdminCategory, 'id' | 'name' | 'is_active'>
export type StoreAdminProductListItem = {
  id: string; name: string; slug: string; publication_status: StorePublicationStatus
  product_mode: 'physical' | 'digital' | 'hybrid'; is_featured: boolean; updated_at: string
  category: { name: string } | null
}
export type StoreAdminProduct = Omit<StoreAdminProductListItem, 'category'> & {
  category_id: string | null; description: string | null; short_description: string | null
  sort_order: number; seo_title: string | null; seo_description: string | null
}
export type StoreProductReadinessIssue = { code: string; scope: string; variant_id: string | null; message_key: string }
export type StoreAdminProductImage = {
  id: string; product_id: string; storage_bucket: string; storage_path: string
  alt_text: string | null; sort_order: number; is_primary: boolean; is_active: boolean
  created_at: string; preview_url: string | null
}

const STORE_IMAGE_PREVIEW_TTL_SECONDS = 300

type CategoryCountRelation = { count: number }[] | null

/**
 * Reads only the fields needed by the Store admin landing page. The ordinary
 * cookie-backed client deliberately preserves the caller's RLS boundary.
 */
export async function getStoreAdminOverview(): Promise<StoreAdminOverview | null> {
  const supabase = await createClient()
  const [categoriesResult, productsResult] = await Promise.all([
    supabase.from('evo_store_categories').select('id'),
    supabase.from('evo_store_products').select('publication_status'),
  ])

  if (categoriesResult.error || productsResult.error) return null

  const products = productsResult.data ?? []
  const countStatus = (status: StorePublicationStatus) =>
    products.filter((product) => product.publication_status === status).length

  return {
    categories: categoriesResult.data?.length ?? 0,
    products: products.length,
    draft: countStatus('draft'),
    published: countStatus('published'),
    archived: countStatus('archived'),
  }
}

export async function getStoreAdminCategories(): Promise<{
  categories: StoreAdminCategoryListItem[]
  hasError: boolean
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_store_categories')
    .select('id,name,slug,description,sort_order,is_active,products:evo_store_products(count)')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { categories: [], hasError: true }

  return {
    categories: (data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sort_order: category.sort_order,
      is_active: category.is_active,
      product_count: ((category.products as CategoryCountRelation) ?? [])[0]?.count ?? 0,
    })),
    hasError: false,
  }
}

export async function getStoreAdminCategory(id: string): Promise<{
  category: StoreAdminCategory | null
  hasError: boolean
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_store_categories')
    .select('id,name,slug,description,sort_order,is_active')
    .eq('id', id)
    .maybeSingle()

  if (error) return { category: null, hasError: true }
  return { category: data, hasError: false }
}

export async function getStoreAdminProducts(): Promise<{ products: StoreAdminProductListItem[]; hasError: boolean }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('evo_store_products')
    .select('id,name,slug,publication_status,product_mode,is_featured,updated_at,category:evo_store_categories(name)')
    .order('updated_at', { ascending: false })
  if (error) return { products: [], hasError: true }
  return { products: (data ?? []).map((product) => ({
    ...product,
    category: Array.isArray(product.category) ? product.category[0] ?? null : product.category,
  })) as StoreAdminProductListItem[], hasError: false }
}

export async function getStoreAdminProduct(id: string): Promise<{ product: StoreAdminProduct | null; hasError: boolean }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('evo_store_products')
    .select('id,category_id,name,slug,description,short_description,product_mode,is_featured,sort_order,seo_title,seo_description,publication_status,updated_at')
    .eq('id', id).maybeSingle()
  return error ? { product: null, hasError: true } : { product: data as StoreAdminProduct | null, hasError: false }
}

export async function getStoreAdminProductCategories(): Promise<{ categories: StoreAdminCategoryOption[]; hasError: boolean }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('evo_store_categories').select('id,name,is_active').order('name')
  return error ? { categories: [], hasError: true } : { categories: data ?? [], hasError: false }
}

export async function inspectStoreAdminProductReadiness(id: string): Promise<{ issues: StoreProductReadinessIssue[]; hasError: boolean }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('inspect_evo_store_product_readiness', { p_product_id: id })
  return error ? { issues: [], hasError: true } : { issues: (data ?? []) as StoreProductReadinessIssue[], hasError: false }
}

/** Lists image metadata once and signs its private object paths in one Storage request. */
export async function getStoreAdminProductImages(productId: string): Promise<{ images: StoreAdminProductImage[]; hasError: boolean }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('evo_store_product_images')
    .select('id,product_id,storage_bucket,storage_path,alt_text,sort_order,is_primary,is_active,created_at')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) return { images: [], hasError: true }
  const rows = data ?? []
  if (!rows.length) return { images: [], hasError: false }
  const { data: signed, error: signedError } = await supabase.storage
    .from('evo-store-products')
    .createSignedUrls(rows.map((image) => image.storage_path), STORE_IMAGE_PREVIEW_TTL_SECONDS)
  const urls = new Map((signed ?? []).map((item) => [item.path, item.error ? null : item.signedUrl]))
  return {
    images: rows.map((image) => ({ ...image, preview_url: urls.get(image.storage_path) ?? null })),
    hasError: Boolean(signedError),
  }
}
