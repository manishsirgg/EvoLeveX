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
