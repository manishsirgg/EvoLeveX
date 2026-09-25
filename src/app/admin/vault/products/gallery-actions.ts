'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { hasValidImageSignature, validatedImageExtension } from '@/lib/public-image-upload'
import { createClient } from '@/lib/supabase/server'
import {
  ownedVaultGalleryPath,
  VAULT_GALLERY_BUCKET,
  VAULT_GALLERY_MAX_BYTES,
  vaultGalleryPath,
} from '@/lib/vault-gallery-image'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type GalleryActionState = { error?: string; success?: string; warning?: string }
export const initialGalleryState: GalleryActionState = {}

type Supabase = Awaited<ReturnType<typeof createClient>>
type GalleryRow = { id: string; vault_product_id: string; storage_bucket: string; storage_path: string }

const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()

function parseMetadata(data: FormData) {
  const rawSortOrder = text(data, 'sort_order') || '0'
  if (!/^\d+$/.test(rawSortOrder) || !Number.isSafeInteger(Number(rawSortOrder))) {
    return { error: 'Sort order must be a whole number of zero or greater.' }
  }
  return { altText: text(data, 'alt_text') || null, sortOrder: Number(rawSortOrder) }
}

async function validateImage(data: FormData) {
  const file = data.get('gallery_image')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image to upload.' }
  if (file.size > VAULT_GALLERY_MAX_BYTES) return { error: 'Gallery images must be 5 MB or smaller.' }
  const extension = validatedImageExtension(file)
  if (!extension) return { error: 'Gallery images must be JPG, PNG, or WebP.' }
  if (!(await hasValidImageSignature(file, extension))) return { error: 'The selected image is malformed or does not match its file type.' }
  return { file, extension }
}

async function productExists(supabase: Supabase, productId: string) {
  if (!UUID.test(productId)) return false
  const result = await supabase.from('evo_vault_products').select('id').eq('id', productId).maybeSingle()
  return !result.error && Boolean(result.data)
}

async function findGalleryRow(supabase: Supabase, imageId: string): Promise<GalleryRow | null> {
  if (!UUID.test(imageId)) return null
  const result = await supabase
    .from('evo_vault_product_images')
    .select('id,vault_product_id,storage_bucket,storage_path')
    .eq('id', imageId)
    .maybeSingle()
  return result.error ? null : result.data as GalleryRow | null
}

async function removeManagedObject(supabase: Supabase, row: GalleryRow, productId: string) {
  const path = ownedVaultGalleryPath(row.storage_bucket, row.storage_path, productId)
  if (!path) return false
  const result = await supabase.storage.from(VAULT_GALLERY_BUCKET).remove([path])
  return !result.error
}

function refreshGallery(productId: string) {
  revalidatePath(`/admin/vault/products/${productId}/edit`)
}

export async function uploadVaultGalleryImageAction(productId: string, _state: GalleryActionState, data: FormData): Promise<GalleryActionState> {
  await requireAdmin()
  const supabase = await createClient()
  if (!(await productExists(supabase, productId))) return { error: 'This product is unavailable.' }
  const metadata = parseMetadata(data)
  if (metadata.error) return { error: metadata.error }
  const image = await validateImage(data)
  if (image.error || !image.file || !image.extension) return { error: image.error }

  const storagePath = vaultGalleryPath(productId, image.extension)
  const upload = await supabase.storage.from(VAULT_GALLERY_BUCKET).upload(storagePath, image.file, {
    contentType: image.file.type,
    upsert: false,
  })
  if (upload.error) return { error: 'The gallery image could not be uploaded. Please try again.' }

  const publicUrl = supabase.storage.from(VAULT_GALLERY_BUCKET).getPublicUrl(storagePath).data.publicUrl
  const insert = await supabase.from('evo_vault_product_images').insert({
    vault_product_id: productId,
    storage_bucket: VAULT_GALLERY_BUCKET,
    storage_path: storagePath,
    public_url: publicUrl,
    alt_text: metadata.altText,
    sort_order: metadata.sortOrder,
  }).select('id').single()

  if (insert.error || !insert.data) {
    const cleanup = await supabase.storage.from(VAULT_GALLERY_BUCKET).remove([storagePath])
    return cleanup.error
      ? { error: 'The gallery image could not be attached, and its uploaded file could not be cleaned up. Contact an administrator.' }
      : { error: 'The gallery image could not be attached. The uploaded file was removed; please try again.' }
  }

  refreshGallery(productId)
  return { success: 'Gallery image added.' }
}

export async function updateVaultGalleryImageAction(productId: string, imageId: string, _state: GalleryActionState, data: FormData): Promise<GalleryActionState> {
  await requireAdmin()
  const supabase = await createClient()
  if (!(await productExists(supabase, productId))) return { error: 'This product is unavailable.' }
  const row = await findGalleryRow(supabase, imageId)
  if (!row || row.vault_product_id !== productId) return { error: 'This gallery image does not belong to the requested product.' }
  const metadata = parseMetadata(data)
  if (metadata.error) return { error: metadata.error }

  const suppliedFile = data.get('gallery_image')
  const replacing = suppliedFile instanceof File && suppliedFile.size > 0
  let newPath: string | null = null
  let newPublicUrl: string | null = null

  if (replacing) {
    const image = await validateImage(data)
    if (image.error || !image.file || !image.extension) return { error: image.error }
    newPath = vaultGalleryPath(productId, image.extension)
    const upload = await supabase.storage.from(VAULT_GALLERY_BUCKET).upload(newPath, image.file, {
      contentType: image.file.type,
      upsert: false,
    })
    if (upload.error) return { error: 'The replacement image could not be uploaded. The existing image was preserved.' }
    newPublicUrl = supabase.storage.from(VAULT_GALLERY_BUCKET).getPublicUrl(newPath).data.publicUrl
  }

  const changes = {
    alt_text: metadata.altText,
    sort_order: metadata.sortOrder,
    ...(newPath && newPublicUrl ? { storage_bucket: VAULT_GALLERY_BUCKET, storage_path: newPath, public_url: newPublicUrl } : {}),
  }
  const update = await supabase.from('evo_vault_product_images').update(changes).eq('id', row.id).eq('vault_product_id', productId).select('id').single()
  if (update.error || !update.data) {
    const cleanup = newPath ? await supabase.storage.from(VAULT_GALLERY_BUCKET).remove([newPath]) : null
    if (cleanup?.error) return { error: 'The replacement could not be attached, and its new uploaded file could not be cleaned up. The existing image was preserved; contact an administrator.' }
    return { error: replacing ? 'The replacement could not be attached. The existing image was preserved.' : 'The gallery details could not be saved.' }
  }

  refreshGallery(productId)
  if (replacing && !(await removeManagedObject(supabase, row, productId))) {
    return { success: 'Gallery image replaced.', warning: 'The previous managed image could not be removed. Contact an administrator to clean it up.' }
  }
  return { success: replacing ? 'Gallery image replaced.' : 'Gallery details saved.' }
}

export async function removeVaultGalleryImageAction(productId: string, imageId: string, _state: GalleryActionState, _data: FormData): Promise<GalleryActionState> {
  void _state
  void _data
  await requireAdmin()
  const supabase = await createClient()
  if (!(await productExists(supabase, productId))) return { error: 'This product is unavailable.' }
  const row = await findGalleryRow(supabase, imageId)
  if (!row || row.vault_product_id !== productId) return { error: 'This gallery image does not belong to the requested product.' }

  const removal = await supabase.from('evo_vault_product_images').delete().eq('id', row.id).eq('vault_product_id', productId).select('id').single()
  if (removal.error || !removal.data) return { error: 'The gallery image could not be removed. Please try again.' }

  refreshGallery(productId)
  if (!(await removeManagedObject(supabase, row, productId))) {
    return { success: 'Gallery image removed.', warning: 'Its managed file could not be cleaned up. Contact an administrator.' }
  }
  return { success: 'Gallery image removed.' }
}
