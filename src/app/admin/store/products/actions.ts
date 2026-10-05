'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { mapStoreProductDatabaseError, mapStoreProductImageDatabaseError, mapStoreProductVariantDatabaseError, mapStoreVariantPriceDatabaseError } from '@/lib/admin-store-errors'
import { isStoreUuid, parseStoreCurrency, parseStorePriceActiveState, parseStoreProductImageFile, parseStoreProductImageMetadata, parseStoreProductMutation, parseStoreVariantMutation, parseStoreVariantPriceAmount, STORE_PRODUCT_IMAGE_BUCKET, type StoreAdminActionState, type StoreVariantMutation } from '@/lib/admin-store-validation'
import { createClient } from '@/lib/supabase/server'

const ARCHIVED_MESSAGE = 'Archived products are read-only and cannot be restored in the V1 admin.'
const STALE_MESSAGE = 'This product changed in another session or is no longer mutable. Refresh and try again.'

export type StoreImageActionState = { success?: string; error?: string }
export type StoreVariantActionState = { success?: string; error?: string }
export type StoreVariantPriceActionState = { success?: string; error?: string }
export type StoreImageUploadPreparation = StoreImageActionState & {
  upload?: { imageId: string; bucket: typeof STORE_PRODUCT_IMAGE_BUCKET; path: string; contentType: string }
}

function productInput(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(['name', 'slug', 'category_id', 'description', 'short_description', 'is_featured', 'sort_order', 'seo_title', 'seo_description'].map((key) => [key, formData.get(key)]))
}

function fields(data: ReturnType<typeof parseStoreProductMutation> & { success: true }) {
  return Object.fromEntries(Object.entries(data.data).map(([key, value]) => [key, value === null ? '' : typeof value === 'boolean' ? (value ? 'on' : '') : String(value)]))
}

function revalidateProductRoutes(id?: string) {
  revalidatePath('/admin/store')
  revalidatePath('/admin/store/products')
  if (id) revalidatePath(`/admin/store/products/${id}`)
}

async function loadMutableVariantProduct(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const { data, error } = await supabase.from('evo_store_products')
    .select('id,product_mode,publication_status').eq('id', productId).maybeSingle()
  if (error) return { error: mapStoreProductVariantDatabaseError(error) }
  if (!data) return { error: 'This product could not be found.' }
  if (data.product_mode !== 'physical') return { error: 'Variants can only be managed for physical products.' }
  if (data.publication_status === 'archived') return { error: 'Archived products are read-only. Variants cannot be changed.' }
  return { product: data }
}

async function loadOwnedVariant(supabase: Awaited<ReturnType<typeof createClient>>, productId: string, variantId: string) {
  const { data, error } = await supabase.from('evo_store_variants').select('id,weight_g,is_active')
    .eq('id', variantId).eq('product_id', productId).maybeSingle()
  if (error) return { error: mapStoreProductVariantDatabaseError(error) }
  return data ? { variant: data } : { error: 'That variant does not belong to this product or no longer exists.' }
}

async function loadOwnedVariantPrice(supabase: Awaited<ReturnType<typeof createClient>>, variantId: string, priceId: string) {
  const { data, error } = await supabase.from('evo_store_variant_prices')
    .select('id,variant_id,currency,amount,is_active').eq('id', priceId).eq('variant_id', variantId).maybeSingle()
  if (error) return { error: mapStoreVariantPriceDatabaseError(error) }
  return data ? { price: data } : { error: 'That price does not belong to this variant or no longer exists.' }
}

async function loadMutablePriceProduct(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const { data, error } = await supabase.from('evo_store_products')
    .select('id,product_mode,publication_status').eq('id', productId).maybeSingle()
  if (error) return { error: mapStoreVariantPriceDatabaseError(error) }
  if (!data) return { error: 'This product could not be found.' }
  if (data.product_mode !== 'physical') return { error: 'Prices can only be managed for physical products.' }
  if (data.publication_status === 'archived') return { error: 'Archived products are read-only. Prices cannot be changed.' }
  return { product: data }
}

function variantInput(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(['sku', 'size_code', 'color_code', 'weight_g', 'sort_order'].map((key) => [key, formData.get(key)]))
}

export async function createStoreProductVariantAction(productId: string, formData: FormData): Promise<StoreVariantActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  const parsed = parseStoreVariantMutation(variantInput(formData))
  if (!parsed.success) return { error: parsed.error }
  const supabase = await createClient()
  const current = await loadMutableVariantProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  // Legacy price is compatibility-only; clients cannot supply it. New variants are always inactive.
  const payload = { ...parsed.data, product_id: productId, price: 0, is_active: false }
  const { error } = await supabase.from('evo_store_variants').insert(payload)
  if (error) return { error: mapStoreProductVariantDatabaseError(error) }
  revalidateProductRoutes(productId)
  return { success: 'Variant created inactive. Configure its dependencies before activation.' }
}

export async function updateStoreProductVariantAction(productId: string, variantId: string, input: StoreVariantMutation): Promise<StoreVariantActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(variantId)) return { error: 'This variant could not be found.' }
  const parsed = parseStoreVariantMutation(input as unknown as Record<string, unknown>)
  if (!parsed.success) return { error: parsed.error }
  const supabase = await createClient()
  const current = await loadMutableVariantProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const owned = await loadOwnedVariant(supabase, productId, variantId)
  if ('error' in owned) return { error: owned.error }
  const { data, error } = await supabase.from('evo_store_variants').update(parsed.data)
    .eq('id', variantId).eq('product_id', productId).select('id').maybeSingle()
  if (error) return { error: mapStoreProductVariantDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(productId)
  return { success: 'Variant details updated.' }
}

export async function setStoreProductVariantActiveState(productId: string, variantId: string, active: boolean): Promise<StoreVariantActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(variantId)) return { error: 'This variant could not be found.' }
  if (typeof active !== 'boolean') return { error: 'Choose a valid variant state.' }
  const supabase = await createClient()
  const current = await loadMutableVariantProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const owned = await loadOwnedVariant(supabase, productId, variantId)
  if ('error' in owned) return { error: owned.error }
  if (active && (!owned.variant.weight_g || owned.variant.weight_g <= 0)) return { error: 'Set a positive Weight (g) before activating this variant.' }
  if (active && current.product.publication_status === 'published') {
    const [prices, inventory] = await Promise.all([
      supabase.from('evo_store_variant_prices').select('id').eq('variant_id', variantId).eq('is_active', true).gt('amount', 0).limit(1),
      supabase.from('evo_store_inventory').select('variant_id').eq('variant_id', variantId).maybeSingle(),
    ])
    if (prices.error || inventory.error) return { error: 'Variant dependencies could not be checked. Please try again.' }
    if (!prices.data?.length || !inventory.data) return { error: 'Configure inventory and an active price before activating this variant on a published product.' }
  }
  const { data, error } = await supabase.from('evo_store_variants').update({ is_active: active })
    .eq('id', variantId).eq('product_id', productId).select('id').maybeSingle()
  if (error) return { error: mapStoreProductVariantDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(productId)
  return { success: active ? 'Variant activated.' : 'Variant deactivated.' }
}

export async function createStoreVariantPriceAction(productId: string, variantId: string, currencyInput: string, amountInput: string): Promise<StoreVariantPriceActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(variantId)) return { error: 'This variant could not be found.' }
  const supabase = await createClient()
  const current = await loadMutablePriceProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const owned = await loadOwnedVariant(supabase, productId, variantId)
  if ('error' in owned) return { error: owned.error }
  const currency = parseStoreCurrency(currencyInput)
  if (!currency) return { error: 'Select a supported currency.' }
  const parsed = parseStoreVariantPriceAmount(amountInput, currency)
  if (!parsed.success) return { error: parsed.error }
  if (!parsed.positive) return { error: 'Active prices must be greater than zero.' }
  const payload = { variant_id: owned.variant.id, currency, amount: parsed.amount, is_active: true }
  const { error } = await supabase.from('evo_store_variant_prices').insert(payload)
  if (error) return { error: mapStoreVariantPriceDatabaseError(error) }
  revalidateProductRoutes(productId)
  return { success: `${currency} price added and activated.` }
}

export async function updateStoreVariantPriceAction(productId: string, variantId: string, priceId: string, amountInput: string): Promise<StoreVariantPriceActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(variantId)) return { error: 'This variant could not be found.' }
  if (!isStoreUuid(priceId)) return { error: 'This price could not be found.' }
  const supabase = await createClient()
  const current = await loadMutablePriceProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const ownedVariant = await loadOwnedVariant(supabase, productId, variantId)
  if ('error' in ownedVariant) return { error: ownedVariant.error }
  const ownedPrice = await loadOwnedVariantPrice(supabase, variantId, priceId)
  if ('error' in ownedPrice) return { error: ownedPrice.error }
  const currency = parseStoreCurrency(ownedPrice.price.currency)
  if (!currency) return { error: 'The existing price currency is not supported.' }
  const parsed = parseStoreVariantPriceAmount(amountInput, currency)
  if (!parsed.success) return { error: parsed.error }
  if (ownedPrice.price.is_active && !parsed.positive) return { error: 'Active prices must be greater than zero.' }
  const { data, error } = await supabase.from('evo_store_variant_prices').update({ amount: parsed.amount })
    .eq('id', priceId).eq('variant_id', ownedVariant.variant.id).select('id').maybeSingle()
  if (error) return { error: mapStoreVariantPriceDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(productId)
  return { success: `${currency} amount updated.` }
}

export async function setStoreVariantPriceActiveStateAction(productId: string, variantId: string, priceId: string, active: boolean): Promise<StoreVariantPriceActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(variantId)) return { error: 'This variant could not be found.' }
  if (!isStoreUuid(priceId)) return { error: 'This price could not be found.' }
  const parsedActive = parseStorePriceActiveState(active)
  if (parsedActive === null) return { error: 'Choose a valid price state.' }
  const supabase = await createClient()
  const current = await loadMutablePriceProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const ownedVariant = await loadOwnedVariant(supabase, productId, variantId)
  if ('error' in ownedVariant) return { error: ownedVariant.error }
  const ownedPrice = await loadOwnedVariantPrice(supabase, variantId, priceId)
  if ('error' in ownedPrice) return { error: ownedPrice.error }
  const currency = parseStoreCurrency(ownedPrice.price.currency)
  if (!currency) return { error: 'The existing price currency is not supported.' }
  const amount = parseStoreVariantPriceAmount(String(ownedPrice.price.amount), currency)
  if (parsedActive && (!amount.success || !amount.positive)) return { error: 'Active prices must be greater than zero.' }
  const { data, error } = await supabase.from('evo_store_variant_prices').update({ is_active: parsedActive })
    .eq('id', priceId).eq('variant_id', ownedVariant.variant.id).select('id').maybeSingle()
  if (error) return { error: mapStoreVariantPriceDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(productId)
  return { success: parsedActive ? 'Price activated.' : 'Price deactivated.' }
}

export async function createStoreProductAction(_state: StoreAdminActionState, formData: FormData): Promise<StoreAdminActionState> {
  await requireAdmin()
  const parsed = parseStoreProductMutation(productInput(formData))
  if (!parsed.success) return parsed.state
  const supabase = await createClient()
  const createPayload = { ...parsed.data, product_mode: 'physical' as const, publication_status: 'draft' as const }
  const { data, error } = await supabase.from('evo_store_products').insert(createPayload).select('id').single()
  if (error || !data) return { error: mapStoreProductDatabaseError(error), fields: fields(parsed) }
  revalidateProductRoutes(data.id)
  redirect(`/admin/store/products/${data.id}?success=created`)
}

export async function updateStoreProductAction(id: string, _state: StoreAdminActionState, formData: FormData): Promise<StoreAdminActionState> {
  await requireAdmin()
  if (!isStoreUuid(id)) return { error: 'This product could not be found.' }
  const parsed = parseStoreProductMutation(productInput(formData))
  if (!parsed.success) return parsed.state
  const supabase = await createClient()
  const current = await supabase.from('evo_store_products').select('publication_status').eq('id', id).maybeSingle()
  if (current.error) return { error: mapStoreProductDatabaseError(current.error), fields: fields(parsed) }
  if (!current.data) return { error: 'This product could not be found.' }
  if (current.data.publication_status === 'archived') return { error: ARCHIVED_MESSAGE }
  const { data, error } = await supabase.from('evo_store_products').update(parsed.data).eq('id', id).neq('publication_status', 'archived').select('id').maybeSingle()
  if (error) return { error: mapStoreProductDatabaseError(error), fields: fields(parsed) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(id)
  redirect(`/admin/store/products/${id}?success=updated`)
}

export async function publishStoreProductAction(id: string, _state: StoreAdminActionState, _formData: FormData): Promise<StoreAdminActionState> {
  void _state; void _formData
  await requireAdmin()
  if (!isStoreUuid(id)) return { error: 'This product could not be found.' }
  const supabase = await createClient()
  const current = await supabase.from('evo_store_products').select('publication_status').eq('id', id).maybeSingle()
  if (current.error) return { error: mapStoreProductDatabaseError(current.error) }
  if (!current.data) return { error: 'This product could not be found.' }
  if (current.data.publication_status === 'archived') return { error: ARCHIVED_MESSAGE }
  if (current.data.publication_status === 'published') return { success: 'This product is already published.' }
  await supabase.rpc('inspect_evo_store_product_readiness', { p_product_id: id }) // Advisory only; the update remains authoritative.
  const { data, error } = await supabase.from('evo_store_products').update({ publication_status: 'published' }).eq('id', id).eq('publication_status', 'draft').select('id').maybeSingle()
  if (error) return { error: mapStoreProductDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(id)
  redirect(`/admin/store/products/${id}?success=published`)
}

export async function archiveStoreProductAction(id: string, _state: StoreAdminActionState, _formData: FormData): Promise<StoreAdminActionState> {
  void _state; void _formData
  await requireAdmin()
  if (!isStoreUuid(id)) return { error: 'This product could not be found.' }
  const supabase = await createClient()
  const current = await supabase.from('evo_store_products').select('publication_status').eq('id', id).maybeSingle()
  if (current.error) return { error: mapStoreProductDatabaseError(current.error) }
  if (!current.data) return { error: 'This product could not be found.' }
  if (current.data.publication_status === 'archived') return { error: ARCHIVED_MESSAGE }
  const { data, error } = await supabase.from('evo_store_products').update({ publication_status: 'archived' }).eq('id', id).in('publication_status', ['draft', 'published']).select('id').maybeSingle()
  if (error) return { error: mapStoreProductDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(id)
  redirect(`/admin/store/products/${id}?success=archived`)
}

async function loadMutableImageProduct(supabase: Awaited<ReturnType<typeof createClient>>, productId: string) {
  const result = await supabase.from('evo_store_products').select('id,publication_status').eq('id', productId).maybeSingle()
  if (result.error) return { error: mapStoreProductImageDatabaseError(result.error) }
  if (!result.data) return { error: 'This product could not be found.' }
  if (result.data.publication_status === 'archived') return { error: ARCHIVED_MESSAGE }
  return { product: result.data }
}

async function loadOwnedImage(supabase: Awaited<ReturnType<typeof createClient>>, productId: string, imageId: string) {
  const result = await supabase.from('evo_store_product_images')
    .select('id,is_active,is_primary,storage_path').eq('id', imageId).eq('product_id', productId).maybeSingle()
  if (result.error) return { error: mapStoreProductImageDatabaseError(result.error) }
  if (!result.data) return { error: 'That image does not belong to this product.' }
  return { image: result.data }
}

async function hasUploadedImageObject(supabase: Awaited<ReturnType<typeof createClient>>, productId: string, storagePath: string) {
  const objectName = storagePath.slice(productId.length + 1)
  const { data, error } = await supabase.storage.from(STORE_PRODUCT_IMAGE_BUCKET).list(productId, { search: objectName, limit: 10 })
  return !error && Boolean(data?.some((entry) => entry.name === objectName))
}

export async function prepareStoreProductImageUpload(productId: string, file: { name: string; type: string; size: number }): Promise<StoreImageUploadPreparation> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  const parsed = parseStoreProductImageFile(file)
  if (!parsed.success) return { error: parsed.error }
  const supabase = await createClient()
  const current = await loadMutableImageProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const imageId = crypto.randomUUID()
  const path = `${productId}/${imageId}.${parsed.extension}`
  const { error } = await supabase.from('evo_store_product_images').insert({
    id: imageId, product_id: productId, storage_bucket: STORE_PRODUCT_IMAGE_BUCKET,
    storage_path: path, is_active: false, is_primary: false,
  })
  if (error) return { error: mapStoreProductImageDatabaseError(error) }
  revalidateProductRoutes(productId)
  return { success: 'Upload prepared.', upload: { imageId, bucket: STORE_PRODUCT_IMAGE_BUCKET, path, contentType: parsed.mimeType } }
}

export async function finalizeStoreProductImageUpload(productId: string, imageId: string): Promise<StoreImageActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(imageId)) return { error: 'This image could not be found.' }
  const supabase = await createClient()
  const current = await loadMutableImageProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const owned = await loadOwnedImage(supabase, productId, imageId)
  if ('error' in owned) return { error: owned.error }
  if (!await hasUploadedImageObject(supabase, productId, owned.image.storage_path)) return { error: 'The upload is not available yet. Retry the upload, then finalize it.' }
  const activated = await supabase.from('evo_store_product_images').update({ is_active: true })
    .eq('id', imageId).eq('product_id', productId).eq('is_active', false).select('id').maybeSingle()
  if (activated.error) return { error: mapStoreProductImageDatabaseError(activated.error) }
  const primary = await supabase.from('evo_store_product_images').select('id').eq('product_id', productId)
    .eq('is_active', true).eq('is_primary', true).limit(1).maybeSingle()
  if (primary.error) return { error: mapStoreProductImageDatabaseError(primary.error) }
  if (!primary.data) {
    const { error } = await supabase.rpc('set_evo_store_product_primary_image', { p_product_id: productId, p_image_id: imageId })
    if (error) return { error: mapStoreProductImageDatabaseError(error) }
  }
  revalidateProductRoutes(productId)
  return { success: 'Image uploaded successfully.' }
}

export async function setStoreProductPrimaryImage(productId: string, imageId: string): Promise<StoreImageActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(imageId)) return { error: 'This image could not be found.' }
  const supabase = await createClient()
  const current = await loadMutableImageProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const owned = await loadOwnedImage(supabase, productId, imageId)
  if ('error' in owned) return { error: owned.error }
  if (!owned.image.is_active) return { error: 'Activate the image before setting it as primary.' }
  const { error } = await supabase.rpc('set_evo_store_product_primary_image', { p_product_id: productId, p_image_id: imageId })
  if (error) return { error: mapStoreProductImageDatabaseError(error) }
  revalidateProductRoutes(productId)
  return { success: 'Primary image updated.' }
}

export async function setStoreProductImageActiveState(productId: string, imageId: string, active: boolean): Promise<StoreImageActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(imageId)) return { error: 'This image could not be found.' }
  if (typeof active !== 'boolean') return { error: 'Choose a valid image state.' }
  const supabase = await createClient()
  const current = await loadMutableImageProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const owned = await loadOwnedImage(supabase, productId, imageId)
  if ('error' in owned) return { error: owned.error }
  if (!active && owned.image.is_primary) return { error: 'Set another active image as primary before deactivating this image.' }
  if (active && !await hasUploadedImageObject(supabase, productId, owned.image.storage_path)) {
    return { error: 'This image upload is incomplete. Upload the file successfully before activating it.' }
  }
  let mutation = supabase.from('evo_store_product_images').update({ is_active: active })
    .eq('id', imageId).eq('product_id', productId)
  if (!active) mutation = mutation.eq('is_primary', false)
  const { data, error } = await mutation.select('id').maybeSingle()
  if (error) return { error: mapStoreProductImageDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  if (active) {
    const primary = await supabase.from('evo_store_product_images').select('id').eq('product_id', productId)
      .eq('is_active', true).eq('is_primary', true).limit(1).maybeSingle()
    if (primary.error) return { error: mapStoreProductImageDatabaseError(primary.error) }
    if (!primary.data) {
      const { error: primaryError } = await supabase.rpc('set_evo_store_product_primary_image', { p_product_id: productId, p_image_id: imageId })
      if (primaryError) return { error: mapStoreProductImageDatabaseError(primaryError) }
    }
  }
  revalidateProductRoutes(productId)
  return { success: active ? 'Image activated.' : 'Image deactivated.' }
}

export async function updateStoreProductImageMetadata(productId: string, imageId: string, input: { altText: string; sortOrder: string }): Promise<StoreImageActionState> {
  await requireAdmin()
  if (!isStoreUuid(productId)) return { error: 'This product could not be found.' }
  if (!isStoreUuid(imageId)) return { error: 'This image could not be found.' }
  const parsed = parseStoreProductImageMetadata(input)
  if (!parsed.success) return { error: parsed.error }
  const supabase = await createClient()
  const current = await loadMutableImageProduct(supabase, productId)
  if ('error' in current) return { error: current.error }
  const owned = await loadOwnedImage(supabase, productId, imageId)
  if ('error' in owned) return { error: owned.error }
  const { data, error } = await supabase.from('evo_store_product_images')
    .update({ alt_text: parsed.altText, sort_order: parsed.sortOrder })
    .eq('id', imageId).eq('product_id', productId).select('id').maybeSingle()
  if (error) return { error: mapStoreProductImageDatabaseError(error) }
  if (!data) return { error: STALE_MESSAGE }
  revalidateProductRoutes(productId)
  return { success: 'Image details updated.' }
}
