'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { mapStoreProductDatabaseError, mapStoreProductImageDatabaseError } from '@/lib/admin-store-errors'
import { isStoreUuid, parseStoreProductImageFile, parseStoreProductImageMetadata, parseStoreProductMutation, STORE_PRODUCT_IMAGE_BUCKET, type StoreAdminActionState } from '@/lib/admin-store-validation'
import { createClient } from '@/lib/supabase/server'

const ARCHIVED_MESSAGE = 'Archived products are read-only and cannot be restored in the V1 admin.'
const STALE_MESSAGE = 'This product changed in another session or is no longer mutable. Refresh and try again.'

export type StoreImageActionState = { success?: string; error?: string }
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
