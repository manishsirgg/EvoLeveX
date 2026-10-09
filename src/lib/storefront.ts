import 'server-only'

import { cache } from 'react'

import { formatMoney, type SupportedCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/server'

const STORE_BUCKET = 'evo-store-products'
const SIGNED_IMAGE_TTL_SECONDS = 3600
const CATALOG_LIMIT = 100

export type StoreAvailability = 'in_stock' | 'out_of_stock' | 'unavailable'
export type PublicStoreCategory = { id: string; name: string; slug: string; parent_id: string | null }
export type PublicStoreImage = { id: string; url: string; alt: string; isPrimary: boolean }
export type PublicStoreVariant = {
  id: string
  size: string | null
  color: string | null
  sku: string | null
  price: string | null
  amount: number | null
  availability: StoreAvailability
}
export type PublicStoreCatalogProduct = {
  id: string
  name: string
  slug: string
  shortDescription: string | null
  isFeatured: boolean
  category: PublicStoreCategory
  image: PublicStoreImage | null
  priceLabel: string
  statusLabel: string
}
export type PublicStoreProduct = {
  id: string
  name: string
  slug: string
  shortDescription: string | null
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  category: PublicStoreCategory
  images: PublicStoreImage[]
  variants: PublicStoreVariant[]
  initialVariantId: string
  currency: SupportedCurrency
}

type ProductRow = {
  id: string; category_id: string; name: string; slug: string
  short_description: string | null; description?: string | null
  seo_title?: string | null; seo_description?: string | null; is_featured: boolean
}
type CategoryRow = PublicStoreCategory
type ImageRow = {
  id: string; product_id: string; storage_path: string; alt_text: string | null; is_primary: boolean
}
type VariantRow = {
  id: string; product_id: string; sku: string | null; size_code: string | null; color_code: string | null
}
type PriceRow = { variant_id: string; amount: number | string }
type AvailabilityRow = { variant_id: string; availability: string }

function safeAvailability(value: string | undefined): StoreAvailability {
  return value === 'in_stock' || value === 'out_of_stock' ? value : 'unavailable'
}

function imageAlt(row: ImageRow, productName: string, index = 0) {
  return row.alt_text?.trim() || (row.is_primary ? productName : `${productName} — view ${index + 1}`)
}

async function signImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ImageRow[],
  productNames: Map<string, string>,
) {
  if (!rows.length) return new Map<string, PublicStoreImage>()
  const result = await supabase.storage.from(STORE_BUCKET)
    .createSignedUrls(rows.map((row) => row.storage_path), SIGNED_IMAGE_TTL_SECONDS)
  if (result.error) return new Map<string, PublicStoreImage>()
  const images = new Map<string, PublicStoreImage>()
  rows.forEach((row, index) => {
    const signed = result.data?.[index]
    if (!signed?.signedUrl || signed.error) return
    images.set(row.id, {
      id: row.id,
      url: signed.signedUrl,
      alt: imageAlt(row, productNames.get(row.product_id) ?? 'Evo Store product', index),
      isPrimary: row.is_primary,
    })
  })
  return images
}

export function getInitialStoreVariantId(variants: PublicStoreVariant[]) {
  return variants.find((variant) => variant.amount !== null && variant.availability === 'in_stock')?.id
    ?? variants.find((variant) => variant.amount !== null)?.id
    ?? variants[0]?.id
    ?? ''
}

export function getCatalogPriceLabel(variants: PublicStoreVariant[], currency: SupportedCurrency) {
  const amounts = variants.flatMap((variant) => variant.amount === null ? [] : [variant.amount])
  if (!amounts.length) return `Not available in ${currency}`
  const minimum = Math.min(...amounts)
  return new Set(amounts).size === 1 ? formatMoney(minimum, currency) : `From ${formatMoney(minimum, currency)}`
}

export function getCatalogStatusLabel(variants: PublicStoreVariant[], currency: SupportedCurrency) {
  const priced = variants.filter((variant) => variant.amount !== null)
  if (priced.some((variant) => variant.availability === 'in_stock')) return 'In stock'
  if (priced.some((variant) => variant.availability === 'out_of_stock')) return 'Sold out'
  if (!priced.length) return `Not available in ${currency}`
  return 'Unavailable'
}

function makeVariants(
  rows: VariantRow[], prices: PriceRow[], availability: AvailabilityRow[], currency: SupportedCurrency,
): PublicStoreVariant[] {
  const pricesByVariant = new Map(prices.map((price) => [price.variant_id, Number(price.amount)]))
  const availabilityByVariant = new Map(availability.map((row) => [row.variant_id, row.availability]))
  return rows.map((row) => {
    const amount = pricesByVariant.get(row.id) ?? null
    return {
      id: row.id,
      size: row.size_code,
      color: row.color_code,
      sku: row.sku,
      amount,
      price: amount === null ? null : formatMoney(amount, currency),
      availability: safeAvailability(availabilityByVariant.get(row.id)),
    }
  })
}

export async function getPublicStoreCatalog(currency: SupportedCurrency, categorySlug?: string) {
  try {
    const supabase = await createClient()
    const [categoryResult, productResult] = await Promise.all([
      supabase.from('evo_store_categories').select('id,name,slug,parent_id').eq('is_active', true)
        .order('sort_order', { ascending: true }).order('name', { ascending: true }).order('id', { ascending: true }),
      supabase.from('evo_store_products').select('id,category_id,name,slug,short_description,is_featured')
        .eq('publication_status', 'published').eq('is_active', true).eq('product_mode', 'physical')
        .order('sort_order', { ascending: true }).order('created_at', { ascending: false }).order('id', { ascending: true })
        .limit(CATALOG_LIMIT),
    ])
    if (categoryResult.error || productResult.error) return { products: [], categories: [], hasError: true }
    const categoryRows = (categoryResult.data ?? []) as CategoryRow[]
    const categoryMap = new Map(categoryRows.map((row) => [row.id, row]))
    const validCategory = (id: string) => {
      const category = categoryMap.get(id)
      return Boolean(category && (category.parent_id === null || categoryMap.has(category.parent_id)))
    }
    const allProducts = ((productResult.data ?? []) as ProductRow[]).filter((row) => validCategory(row.category_id))
    const representedIds = new Set(allProducts.flatMap((row) => {
      const category = categoryMap.get(row.category_id)!
      return category.parent_id ? [row.category_id, category.parent_id] : [row.category_id]
    }))
    const categories = categoryRows.filter((row) => representedIds.has(row.id))
    const filtered = categorySlug ? allProducts.filter((row) => {
      const category = categoryMap.get(row.category_id)!
      return category.slug === categorySlug || (category.parent_id !== null && categoryMap.get(category.parent_id)?.slug === categorySlug)
    }) : allProducts
    if (!filtered.length) return { products: [], categories, hasError: false }

    const productIds = filtered.map((row) => row.id)
    const [imageResult, variantResult] = await Promise.all([
      supabase.from('evo_store_product_images').select('id,product_id,storage_path,alt_text,is_primary')
        .in('product_id', productIds).eq('is_active', true).eq('is_primary', true)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }),
      supabase.from('evo_store_variants').select('id,product_id,sku,size_code,color_code')
        .in('product_id', productIds).eq('is_active', true)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }),
    ])
    if (imageResult.error || variantResult.error) return { products: [], categories, hasError: true }
    const category = categoryResult.data as CategoryRow
    if (category.parent_id) {
      const { data: parent, error: parentError } = await supabase.from('evo_store_categories')
        .select('id').eq('id', category.parent_id).eq('is_active', true).maybeSingle()
      if (parentError || !parent) return null
    }
    const imageRows = (imageResult.data ?? []) as ImageRow[]
    const variantRows = (variantResult.data ?? []) as VariantRow[]
    const variantIds = variantRows.map((row) => row.id)
    const [priceResult, availabilityResult, signedImages] = await Promise.all([
      variantIds.length ? supabase.from('evo_store_variant_prices').select('variant_id,amount')
        .in('variant_id', variantIds).eq('currency', currency).eq('is_active', true).gt('amount', 0) : Promise.resolve({ data: [], error: null }),
      variantIds.length ? supabase.rpc('get_evo_store_variant_availability', { p_variant_ids: variantIds }) : Promise.resolve({ data: [], error: null }),
      signImages(supabase, imageRows, new Map(filtered.map((row) => [row.id, row.name]))),
    ])
    if (priceResult.error || availabilityResult.error) return { products: [], categories, hasError: true }
    const prices = (priceResult.data ?? []) as PriceRow[]
    const availability = (availabilityResult.data ?? []) as AvailabilityRow[]
    const primaryByProduct = new Map(imageRows.map((row) => [row.product_id, signedImages.get(row.id) ?? null]))
    const products = filtered.map((row) => {
      const variants = makeVariants(variantRows.filter((variant) => variant.product_id === row.id), prices, availability, currency)
      return {
        id: row.id, name: row.name, slug: row.slug, shortDescription: row.short_description,
        isFeatured: row.is_featured, category: categoryMap.get(row.category_id)!,
        image: primaryByProduct.get(row.id) ?? null,
        priceLabel: getCatalogPriceLabel(variants, currency), statusLabel: getCatalogStatusLabel(variants, currency),
      }
    })
    return { products, categories, hasError: false }
  } catch {
    return { products: [], categories: [], hasError: true }
  }
}

export const getPublicStoreProduct = cache(async (slug: string, currency: SupportedCurrency): Promise<PublicStoreProduct | null> => {
  try {
    const supabase = await createClient()
    const productResult = await supabase.from('evo_store_products')
      .select('id,category_id,name,slug,short_description,description,is_featured,seo_title,seo_description')
      .eq('slug', slug).eq('publication_status', 'published').eq('is_active', true).eq('product_mode', 'physical').maybeSingle()
    if (productResult.error || !productResult.data) return null
    const product = productResult.data as ProductRow
    const [categoryResult, imageResult, variantResult] = await Promise.all([
      supabase.from('evo_store_categories').select('id,name,slug,parent_id').eq('id', product.category_id).eq('is_active', true).maybeSingle(),
      supabase.from('evo_store_product_images').select('id,product_id,storage_path,alt_text,is_primary')
        .eq('product_id', product.id).eq('is_active', true)
        .order('is_primary', { ascending: false }).order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }).order('id', { ascending: true }),
      supabase.from('evo_store_variants').select('id,product_id,sku,size_code,color_code')
        .eq('product_id', product.id).eq('is_active', true)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }),
    ])
    if (categoryResult.error || !categoryResult.data || imageResult.error || variantResult.error) return null
    const imageRows = (imageResult.data ?? []) as ImageRow[]
    const variantRows = (variantResult.data ?? []) as VariantRow[]
    const variantIds = variantRows.map((row) => row.id)
    const [priceResult, availabilityResult, signedImages] = await Promise.all([
      variantIds.length ? supabase.from('evo_store_variant_prices').select('variant_id,amount')
        .in('variant_id', variantIds).eq('currency', currency).eq('is_active', true).gt('amount', 0) : Promise.resolve({ data: [], error: null }),
      variantIds.length ? supabase.rpc('get_evo_store_variant_availability', { p_variant_ids: variantIds }) : Promise.resolve({ data: [], error: null }),
      signImages(supabase, imageRows, new Map([[product.id, product.name]])),
    ])
    if (priceResult.error || availabilityResult.error) return null
    const variants = makeVariants(variantRows, (priceResult.data ?? []) as PriceRow[], (availabilityResult.data ?? []) as AvailabilityRow[], currency)
    if (!variants.length) return null
    return {
      id: product.id, name: product.name, slug: product.slug, shortDescription: product.short_description,
      description: product.description ?? null, seoTitle: product.seo_title ?? null, seoDescription: product.seo_description ?? null,
      category: categoryResult.data as CategoryRow,
      images: imageRows.flatMap((row) => signedImages.get(row.id) ?? []), variants,
      initialVariantId: getInitialStoreVariantId(variants), currency,
    }
  } catch {
    return null
  }
})

export function storeProductUrl(slug: string) {
  return `https://evolevex.com/store/${encodeURIComponent(slug)}`
}
