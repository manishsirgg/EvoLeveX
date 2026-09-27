import { cache } from 'react'

import { isSupportedCurrency, type SupportedCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/server'

export type PublicVaultBookProduct = {
  id: string
  name: string
  slug: string
  shortDescription: string | null
  description: string | null
  productMode: string
  price: number | string
  currency: SupportedCurrency
  coverImageUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  category: { name: string; slug: string } | null
  book: {
    authorName: string | null
    isbn: string | null
    pageCount: number | null
    previewText: string | null
  }
  images: Array<{ id: string; publicUrl: string; altText: string | null }>
}

type ProductRow = {
  id: string
  category_id: string
  name: string
  slug: string
  short_description: string | null
  description: string | null
  product_mode: string
  price: number | string
  currency: string
  cover_image_url: string | null
  seo_title: string | null
  seo_description: string | null
}

/**
 * Loads only the fields needed by the public book storefront. In particular,
 * the private book attachment columns are never selected.
 */
export const getPublicVaultBook = cache(async (slug: string): Promise<PublicVaultBookProduct | null> => {
  const supabase = await createClient()
  const productResult = await supabase
    .from('evo_vault_products')
    .select('id,category_id,name,slug,short_description,description,product_mode,price,currency,cover_image_url,seo_title,seo_description')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('kind', 'book')
    .maybeSingle()

  if (productResult.error || !productResult.data) return null
  const product = productResult.data as ProductRow
  if (!isSupportedCurrency(product.currency)) return null

  const [bookResult, categoryResult, imagesResult] = await Promise.all([
    supabase
      .from('evo_vault_books')
      .select('author_name,isbn,page_count,preview_text')
      .eq('vault_product_id', product.id)
      .maybeSingle(),
    supabase
      .from('evo_vault_categories')
      .select('name,slug')
      .eq('id', product.category_id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('evo_vault_product_images')
      .select('id,public_url,alt_text')
      .eq('vault_product_id', product.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
  ])

  if (bookResult.error || !bookResult.data) return null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.short_description,
    description: product.description,
    productMode: product.product_mode,
    price: product.price,
    currency: product.currency,
    coverImageUrl: product.cover_image_url,
    seoTitle: product.seo_title,
    seoDescription: product.seo_description,
    category: categoryResult.error || !categoryResult.data ? null : categoryResult.data,
    book: {
      authorName: bookResult.data.author_name,
      isbn: bookResult.data.isbn,
      pageCount: bookResult.data.page_count,
      previewText: bookResult.data.preview_text,
    },
    images: imagesResult.error
      ? []
      : (imagesResult.data ?? []).map((image) => ({
        id: image.id,
        publicUrl: image.public_url,
        altText: image.alt_text,
      })),
  }
})

export function vaultProductUrl(slug: string) {
  return `https://evolevex.com/vault/${encodeURIComponent(slug)}`
}

export function vaultProductModeLabel(mode: string) {
  if (mode === 'digital') return 'Digital Book'
  if (mode === 'physical') return 'Print Book'
  if (mode === 'both') return 'Digital + Print Book'
  return 'Book'
}
