export type TvVideo = {
  id: string; series_id: string | null; category_id: string | null; youtube_video_id: string
  title: string; slug: string; description: string | null; thumbnail_url: string | null
  duration_seconds: number | null; featured: boolean; active: boolean; sort_order: number
  published_at: string | null; seo_title: string | null; seo_description: string | null
  created_at: string; updated_at: string
}
export type TvOption = { id: string; label: string; active: boolean }

export function videoState(video: Pick<TvVideo, 'active' | 'published_at'>) {
  if (!video.active) return 'hidden' as const
  if (video.published_at && Date.parse(video.published_at) > Date.now()) return 'scheduled' as const
  return 'public' as const
}

export function youtubeThumbnail(video: Pick<TvVideo, 'thumbnail_url' | 'youtube_video_id'>) {
  return video.thumbnail_url || `https://i.ytimg.com/vi/${encodeURIComponent(video.youtube_video_id)}/hqdefault.jpg`
}
