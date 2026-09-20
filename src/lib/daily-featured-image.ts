export const DAILY_IMAGE_BUCKET = 'evo-public'
export const DAILY_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const DAILY_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function featuredImageExtension(file: File) {
  return IMAGE_EXTENSIONS[file.type] ?? null
}

export async function hasValidImageSignature(file: File, extension: string) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (extension === 'jpg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (extension === 'png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
  if (extension === 'webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return false
}

export function ownedFeaturedImagePath(urlValue: string | null, articleId: string) {
  if (!urlValue) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  try {
    const url = new URL(urlValue)
    const expected = new URL(`/storage/v1/object/public/${DAILY_IMAGE_BUCKET}/`, base)
    if (url.origin !== expected.origin || !url.pathname.startsWith(expected.pathname)) return null
    const path = decodeURIComponent(url.pathname.slice(expected.pathname.length))
    const prefix = `articles/${articleId}/featured/`
    return path.startsWith(prefix) && /^[0-9a-f-]+\.(?:jpg|png|webp)$/i.test(path.slice(prefix.length)) ? path : null
  } catch {
    return null
  }
}

export function ownedEditorialImagePath(urlValue: string | null, articleId: string) {
  if (!urlValue) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  try {
    const url = new URL(urlValue)
    const expected = new URL(`/storage/v1/object/public/${DAILY_IMAGE_BUCKET}/`, base)
    if (url.origin !== expected.origin || !url.pathname.startsWith(expected.pathname)) return null
    const path = decodeURIComponent(url.pathname.slice(expected.pathname.length))
    const prefix = `articles/${articleId}/editorial/`
    return path.startsWith(prefix) && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(path.slice(prefix.length)) ? path : null
  } catch {
    return null
  }
}
