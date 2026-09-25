import { hasValidImageSignature, ownedPublicImagePath, PUBLIC_IMAGE_ACCEPT, PUBLIC_IMAGE_BUCKET, PUBLIC_IMAGE_MAX_BYTES, validatedImageExtension } from './public-image-upload'

export const DAILY_IMAGE_BUCKET = PUBLIC_IMAGE_BUCKET
export const DAILY_IMAGE_MAX_BYTES = PUBLIC_IMAGE_MAX_BYTES
export const DAILY_IMAGE_ACCEPT = PUBLIC_IMAGE_ACCEPT
export const featuredImageExtension = validatedImageExtension
export { hasValidImageSignature }

export function ownedFeaturedImagePath(urlValue: string | null, articleId: string) {
  return ownedPublicImagePath(urlValue, `articles/${articleId}/featured/`)
}

export function ownedEditorialImagePath(urlValue: string | null, articleId: string) {
  return ownedPublicImagePath(urlValue, `articles/${articleId}/editorial/`)
}
