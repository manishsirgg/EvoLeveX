export const AVATAR_BUCKET = 'evo-public'

export function getAvatarPublicUrl(path: string | null) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) return null

  return `${baseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function Avatar({ path, name, size = 'large' }: { path: string | null; name: string; size?: 'small' | 'large' }) {
  const url = getAvatarPublicUrl(path)
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'EX'
  const dimensions = size === 'large' ? 'h-24 w-24 text-2xl' : 'h-14 w-14 text-base'

  if (url) {
    return (
      // Storage URLs are user-controlled at runtime and cannot be safely enumerated in next/image configuration.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={`${name}'s avatar`} className={`${dimensions} shrink-0 rounded-full border border-white/15 object-cover`} />
    )
  }

  return <div role="img" aria-label={`${name}'s avatar placeholder`} className={`${dimensions} grid shrink-0 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10 font-semibold tracking-wider text-amber-200`}>{initials}</div>
}
