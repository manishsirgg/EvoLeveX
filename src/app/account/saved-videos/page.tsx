import Link from 'next/link'
import { redirect } from 'next/navigation'

import { VideoCard } from '@/components/tv/video-card'
import type { TvCategory, TvSeriesSummary, TvVideoSummary } from '@/lib/tv'
import { createClient } from '@/lib/supabase/server'

type BookmarkRow = { video_id: string; created_at: string }
type VideoRow = {
  id: string
  series_id: string | null
  category_id: string | null
  youtube_video_id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  published_at: string | null
}
type SeriesRow = Pick<TvSeriesSummary, 'id' | 'title' | 'slug'>

const savedVideoFields = 'id, series_id, category_id, youtube_video_id, title, slug, description, thumbnail_url, duration_seconds, published_at'

function thumbnailFor(video: Pick<VideoRow, 'thumbnail_url' | 'youtube_video_id'>) {
  const candidate = video.thumbnail_url?.trim()
  if (candidate) {
    try {
      const url = new URL(candidate)
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString()
    } catch {
      // Invalid overrides safely fall through to YouTube's deterministic thumbnail.
    }
  }
  return `https://i.ytimg.com/vi/${encodeURIComponent(video.youtube_video_id)}/hqdefault.jpg`
}

export default async function SavedVideosPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/auth/login')

  const requestTime = new Date().toISOString()
  const { data: bookmarkData, error: bookmarkError } = await supabase
    .from('evo_tv_video_bookmarks')
    .select('video_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('video_id', { ascending: true })

  const bookmarks = (bookmarkData ?? []) as BookmarkRow[]
  const videoIds = bookmarks.map((bookmark) => bookmark.video_id)
  const { data: videoData, error: videoError } = videoIds.length
    ? await supabase
      .from('evo_tv_videos')
      .select(savedVideoFields)
      .in('id', videoIds)
      .eq('active', true)
      .or(`published_at.is.null,published_at.lte.${requestTime}`)
    : { data: [], error: null }

  const videoRows = (videoData ?? []) as VideoRow[]
  const categoryIds = [...new Set(videoRows.map((video) => video.category_id).filter((id): id is string => Boolean(id)))]
  const seriesIds = [...new Set(videoRows.map((video) => video.series_id).filter((id): id is string => Boolean(id)))]
  const [categoryResult, seriesResult] = await Promise.all([
    categoryIds.length
      ? supabase.from('evo_daily_categories').select('id, name, slug').eq('is_active', true).in('id', categoryIds)
      : Promise.resolve({ data: [], error: null }),
    seriesIds.length
      ? supabase.from('evo_tv_series').select('id, title, slug').eq('is_active', true).in('id', seriesIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const categories = new Map(((categoryResult.data ?? []) as TvCategory[]).map((category) => [category.id, category]))
  const series = new Map(((seriesResult.data ?? []) as SeriesRow[]).map((item) => [item.id, item]))
  const videoById = new Map(videoRows.map((video): [string, TvVideoSummary] => [video.id, {
    id: video.id,
    title: video.title,
    slug: video.slug,
    description: video.description,
    thumbnailUrl: thumbnailFor(video),
    durationSeconds: video.duration_seconds,
    publishedAt: video.published_at,
    category: video.category_id ? categories.get(video.category_id) ?? null : null,
    series: video.series_id ? series.get(video.series_id) ?? null : null,
  }]))
  const videos = videoIds.flatMap((id) => videoById.get(id) ?? [])
  const hasError = Boolean(bookmarkError || videoError || categoryResult.error || seriesResult.error)

  return (
    <section aria-labelledby="saved-videos-title" className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Your watchlist</p>
        <h1 id="saved-videos-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Saved Videos</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Keep the Evo TV videos you want to return to in one place.</p>
      </div>

      {hasError ? (
        <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm leading-6 text-amber-100">
          Your saved videos could not be loaded right now. Refresh the page to try again.
        </div>
      ) : videos.length ? (
        <div className="tv-video-grid account-saved-video-grid">{videos.map((video) => <VideoCard key={video.id} video={video} />)}</div>
      ) : (
        <div className="border border-white/10 bg-zinc-900/40 p-8 sm:p-10">
          <h2 className="text-xl font-semibold text-white">Saved Videos</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">Your saved Evo TV videos will appear here.</p>
          <Link href="/tv" className="button-light mt-6 inline-flex px-5 py-3 text-sm">Explore Evo TV</Link>
        </div>
      )}
    </section>
  )
}
