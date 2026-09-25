import {
  PUBLIC_IMAGE_ACCEPT,
  PUBLIC_IMAGE_BUCKET,
  PUBLIC_IMAGE_MAX_BYTES,
} from './public-image-upload'

export const VAULT_GALLERY_BUCKET = PUBLIC_IMAGE_BUCKET
export const VAULT_GALLERY_MAX_BYTES = PUBLIC_IMAGE_MAX_BYTES
export const VAULT_GALLERY_ACCEPT = PUBLIC_IMAGE_ACCEPT

export function vaultGalleryPath(productId: string, extension: string) {
  return `vault/${productId}/gallery/${crypto.randomUUID()}.${extension}`
}

export function ownedVaultGalleryPath(storageBucket: string, storagePath: string, productId: string) {
  if (storageBucket !== VAULT_GALLERY_BUCKET) return null
  const prefix = `vault/${productId}/gallery/`
  if (!storagePath.startsWith(prefix)) return null
  const filename = storagePath.slice(prefix.length)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(filename)
    ? storagePath
    : null
}
