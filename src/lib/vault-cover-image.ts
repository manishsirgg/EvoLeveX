import { ownedPublicImagePath, PUBLIC_IMAGE_ACCEPT, PUBLIC_IMAGE_BUCKET, PUBLIC_IMAGE_MAX_BYTES } from './public-image-upload'

export const VAULT_COVER_BUCKET = PUBLIC_IMAGE_BUCKET
export const VAULT_COVER_MAX_BYTES = PUBLIC_IMAGE_MAX_BYTES
export const VAULT_COVER_ACCEPT = PUBLIC_IMAGE_ACCEPT

export function ownedVaultCoverPath(urlValue: string | null, productId: string) {
  return ownedPublicImagePath(urlValue, `vault/${productId}/cover/`)
}
