export type TvActionState = { error?: string; fields?: Record<string, string> }
export const initialTvState: TvActionState = {}
export function slugifyTv(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }

export function extractYoutubeId(value: string) {
  const raw = value.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    let candidate = ''
    if (host === 'youtu.be') candidate = url.pathname.split('/')[1] ?? ''
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      candidate = url.pathname === '/watch' ? url.searchParams.get('v') ?? '' : url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] ?? ''
    }
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null
  } catch { return null }
}
