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
