import 'server-only'

import type { SupportedCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/server'
import { storeAmountToMinor, storeMoney } from '@/lib/store-money'
import type { StoreCartItem } from '@/lib/store-cart'

const STORE_BUCKET = 'evo-store-products'
const SIGNED_IMAGE_TTL_SECONDS = 3600

export type ResolvedStoreCartLine = {
  variantId: string
  quantity: number
  product: { name: string; slug: string } | null
  image: { url: string; alt: string } | null
  size: string | null
  color: string | null
  sku: string | null
  price: { currency: SupportedCurrency; amount: string; formatted: string } | null
  lineTotal: { amount: string; formatted: string } | null
  availability: 'in_stock' | 'out_of_stock' | 'unavailable' | 'no_longer_available'
  isEligible: boolean
}

export type StoreCartSummary = {
  currency: SupportedCurrency; lineCount: number; itemCount: number
  eligibleLineCount: number; eligibleItemCount: number
  subtotal: { amount: string; formatted: string }
  hasUnavailableLines: boolean; allLinesEligible: boolean
}

type VariantRow = { id: string; product_id: string; sku: string | null; size_code: string | null; color_code: string | null }
type ProductRow = { id: string; category_id: string; name: string; slug: string }
type CategoryRow = { id: string }
type ImageRow = { id: string; product_id: string; storage_path: string; alt_text: string | null }
type PriceRow = { variant_id: string; amount: string | number }
type AvailabilityRow = { variant_id: string; availability: string }

function publicAvailability(value: string | undefined) {
  return value === 'in_stock' || value === 'out_of_stock' ? value : 'unavailable'
}

export async function resolveStoreCart(items: StoreCartItem[], currency: SupportedCurrency): Promise<{ lines: ResolvedStoreCartLine[]; summary: StoreCartSummary }> {
  const supabase = await createClient()
  const variantIds = items.map((item) => item.variant_id)
  const variantResult = await supabase.from('evo_store_variants').select('id,product_id,sku,size_code,color_code')
    .in('id', variantIds).eq('is_active', true)
  if (variantResult.error) throw new Error('cart_resolution_unavailable')
  const variants = (variantResult.data ?? []) as VariantRow[]
  const productIds = [...new Set(variants.map((row) => row.product_id))]
  const productResult = productIds.length ? await supabase.from('evo_store_products')
    .select('id,category_id,name,slug').in('id', productIds)
    .eq('publication_status', 'published').eq('is_active', true).eq('product_mode', 'physical')
    : { data: [], error: null }
  if (productResult.error) throw new Error('cart_resolution_unavailable')
  const products = (productResult.data ?? []) as ProductRow[]
  const categoryIds = [...new Set(products.map((row) => row.category_id))]
  const categoryResult = categoryIds.length ? await supabase.from('evo_store_categories').select('id')
    .in('id', categoryIds).eq('is_active', true) : { data: [], error: null }
  if (categoryResult.error) throw new Error('cart_resolution_unavailable')
  const activeCategories = new Set(((categoryResult.data ?? []) as CategoryRow[]).map((row) => row.id))
  const publicProducts = products.filter((row) => activeCategories.has(row.category_id))
  const publicProductIds = publicProducts.map((row) => row.id)
  const publicVariantIds = variants.filter((row) => publicProductIds.includes(row.product_id)).map((row) => row.id)

  const [imageResult, priceResult, availabilityResult] = await Promise.all([
    publicProductIds.length ? supabase.from('evo_store_product_images').select('id,product_id,storage_path,alt_text')
      .in('product_id', publicProductIds).eq('is_active', true).eq('is_primary', true)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }) : Promise.resolve({ data: [], error: null }),
    publicVariantIds.length ? supabase.from('evo_store_variant_prices').select('variant_id,amount')
      .in('variant_id', publicVariantIds).eq('currency', currency).eq('is_active', true).gt('amount', 0) : Promise.resolve({ data: [], error: null }),
    publicVariantIds.length ? supabase.rpc('get_evo_store_variant_availability', { p_variant_ids: publicVariantIds }) : Promise.resolve({ data: [], error: null }),
  ])
  if (imageResult.error || priceResult.error || availabilityResult.error) throw new Error('cart_resolution_unavailable')
  const images = (imageResult.data ?? []) as ImageRow[]
  const signedResult = images.length
    ? await supabase.storage.from(STORE_BUCKET).createSignedUrls(images.map((row) => row.storage_path), SIGNED_IMAGE_TTL_SECONDS)
    : { data: [], error: null }

  const variantMap = new Map(variants.map((row) => [row.id, row]))
  const productMap = new Map(publicProducts.map((row) => [row.id, row]))
  const priceMap = new Map(((priceResult.data ?? []) as PriceRow[]).map((row) => [row.variant_id, row.amount]))
  const availabilityMap = new Map(((availabilityResult.data ?? []) as AvailabilityRow[]).map((row) => [row.variant_id, row.availability]))
  const imageMap = new Map<string, { url: string; alt: string }>()
  if (!signedResult.error) images.forEach((row, index) => {
    const signed = signedResult.data?.[index]
    const product = productMap.get(row.product_id)
    if (signed?.signedUrl && !signed.error) imageMap.set(row.product_id, { url: signed.signedUrl, alt: row.alt_text?.trim() || product?.name || 'Evo Store product' })
  })

  let subtotalMinor = BigInt(0)
  const lines = items.map((item): ResolvedStoreCartLine => {
    const variant = variantMap.get(item.variant_id)
    const product = variant ? productMap.get(variant.product_id) : undefined
    if (!variant || !product) return { variantId: item.variant_id, quantity: item.quantity, product: null, image: null,
      size: null, color: null, sku: null, price: null, lineTotal: null, availability: 'no_longer_available', isEligible: false }
    const minor = storeAmountToMinor(priceMap.get(variant.id), currency)
    const availability = publicAvailability(availabilityMap.get(variant.id))
    const eligible = minor !== null && minor > BigInt(0) && availability === 'in_stock'
    const total = eligible ? minor * BigInt(item.quantity) : null
    if (total !== null) subtotalMinor += total
    return { variantId: item.variant_id, quantity: item.quantity, product: { name: product.name, slug: product.slug },
      image: imageMap.get(product.id) ?? null, size: variant.size_code, color: variant.color_code, sku: variant.sku,
      price: minor === null ? null : { currency, ...storeMoney(minor, currency) }, lineTotal: total === null ? null : storeMoney(total, currency),
      availability, isEligible: eligible }
  })
  const eligible = lines.filter((line) => line.isEligible)
  const summary = { currency, lineCount: lines.length, itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    eligibleLineCount: eligible.length, eligibleItemCount: eligible.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: storeMoney(subtotalMinor, currency), hasUnavailableLines: eligible.length !== lines.length,
    allLinesEligible: lines.length > 0 && eligible.length === lines.length }
  return { lines, summary }
}
