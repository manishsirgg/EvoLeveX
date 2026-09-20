import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export type TvCategory = { id: string; name: string; slug: string }

export type TvSeriesSummary = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
}

export type TvVideoSummary = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string
  durationSeconds: number | null
  publishedAt: string | null
  category: TvCategory | null
  series: Pick<TvSeriesSummary, 'id' | 'title' | 'slug'> | null
}

export type PublicTvVideo = TvVideoSummary & {
  youtubeVideoId: string
  seoTitle: string | null
  seoDescription: string | null
  createdAt: string
  sortOrder: number
}

export type TvLandingData = {
  activeCategory: TvCategory | null
  categories: TvCategory[]
  featuredVideo: TvVideoSummary | null
  videos: TvVideoSummary[]
  series: TvSeriesSummary[]
  hasNextPage: boolean
  hasError: boolean
}

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
  featured: boolean
  published_at: string | null
  created_at: string
  sort_order: number
  seo_title?: string | null
  seo_description?: string | null
}

type CategoryRow = TvCategory & { sort_order: number | null }
type SeriesRow = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  sort_order: number | null
}

const videoFields = 'id, series_id, category_id, youtube_video_id, title, slug, description, thumbnail_url, duration_seconds, featured, published_at, created_at, sort_order'
const videoDetailFields = `${videoFields}, seo_title, seo_description`
const discoveryCandidateLimit = 600
const seriesLimit = 6
export const tvPageSize = 12

// Two bounded streams capture both sides of effectivePublishedAt (published_at ?? created_at).
// This avoids an unbounded library read while allowing newly published older uploads and
// public, unscheduled uploads to compete correctly. Discovery considers at most 1,200 rows.
function publicAt(now: string) {
  return `published_at.is.null,published_at.lte.${now}`
}

function thumbnailFor(row: Pick<VideoRow, 'thumbnail_url' | 'youtube_video_id'>) {
  const candidate = row.thumbnail_url?.trim()
  if (candidate) {
    try {
      const url = new URL(candidate)
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString()
    } catch {
      // Invalid overrides safely fall through to YouTube's deterministic thumbnail.
    }
  }
  return `https://i.ytimg.com/vi/${encodeURIComponent(row.youtube_video_id)}/hqdefault.jpg`
}

function effectiveTime(row: VideoRow) {
  return Date.parse(row.published_at ?? row.created_at)
}

function latestFirst(left: VideoRow, right: VideoRow) {
  return effectiveTime(right) - effectiveTime(left) || left.id.localeCompare(right.id)
}

function toSummary(row: VideoRow, categoryMap: Map<string, TvCategory>, seriesMap: Map<string, SeriesRow>): TvVideoSummary {
  const linkedSeries = row.series_id ? seriesMap.get(row.series_id) : undefined
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    thumbnailUrl: thumbnailFor(row),
    durationSeconds: row.duration_seconds,
    publishedAt: row.published_at,
    category: row.category_id ? categoryMap.get(row.category_id) ?? null : null,
    series: linkedSeries ? { id: linkedSeries.id, title: linkedSeries.title, slug: linkedSeries.slug } : null,
  }
}

/** Returns null only when no publicly eligible row exists; query failures are thrown. */
export const getPublicTvVideo = cache(async (slug: string): Promise<PublicTvVideo | null> => {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const result = await supabase
    .from('evo_tv_videos')
    .select(videoDetailFields)
    .eq('slug', slug)
    .eq('active', true)
    .or(publicAt(now))
    .maybeSingle()

  if (result.error) {
    console.error('Unable to load public Evo TV video', { code: result.error.code, message: result.error.message })
    throw new Error('Unable to load Evo TV video')
  }
  if (!result.data) return null

  const row = result.data as VideoRow
  const [categoryResult, seriesResult] = await Promise.all([
    row.category_id
      ? supabase.from('evo_daily_categories').select('id, name, slug, sort_order').eq('id', row.category_id).eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.series_id
      ? supabase.from('evo_tv_series').select('id, title, slug, description, thumbnail_url, sort_order').eq('id', row.series_id).eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  // Relationship availability must never make an otherwise public video unavailable.
  if (categoryResult.error) console.error('Unable to resolve public Evo TV category', { code: categoryResult.error.code, message: categoryResult.error.message })
  if (seriesResult.error) console.error('Unable to resolve public Evo TV series', { code: seriesResult.error.code, message: seriesResult.error.message })
  const categoryMap = new Map<string, TvCategory>()
  const seriesMap = new Map<string, SeriesRow>()
  if (categoryResult.data) categoryMap.set(categoryResult.data.id, categoryResult.data as CategoryRow)
  if (seriesResult.data) seriesMap.set(seriesResult.data.id, seriesResult.data as SeriesRow)
  const summary = toSummary(row, categoryMap, seriesMap)

  return {
    ...summary,
    youtubeVideoId: row.youtube_video_id,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
  }
})

export async function getRelatedTvVideos(video: PublicTvVideo): Promise<TvVideoSummary[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const candidates = () => supabase.from('evo_tv_videos').select(videoFields).eq('active', true).or(publicAt(now)).neq('id', video.id)
  const nullPublished = (query: ReturnType<typeof candidates>) => query.is('published_at', null).order('created_at', { ascending: false }).order('sort_order').order('id').limit(10)
  const datedPublished = (query: ReturnType<typeof candidates>) => query.not('published_at', 'is', null).order('published_at', { ascending: false }).order('sort_order').order('id').limit(10)
  const queries = [
    video.series ? nullPublished(candidates().eq('series_id', video.series.id)) : Promise.resolve({ data: [], error: null }),
    video.series ? datedPublished(candidates().eq('series_id', video.series.id)) : Promise.resolve({ data: [], error: null }),
    video.category ? nullPublished(candidates().eq('category_id', video.category.id)) : Promise.resolve({ data: [], error: null }),
    video.category ? datedPublished(candidates().eq('category_id', video.category.id)) : Promise.resolve({ data: [], error: null }),
    nullPublished(candidates()),
    datedPublished(candidates()),
  ]
  const results = await Promise.all(queries)
  const errors = results.map((result) => result.error).filter(Boolean)
  if (errors.length) {
    console.error('Unable to load related Evo TV videos', errors.map((error) => ({ code: error?.code, message: error?.message })))
    return []
  }

  const rowsById = new Map<string, VideoRow>()
  for (const result of results) for (const row of (result.data ?? []) as VideoRow[]) rowsById.set(row.id, row)
  const rows = [...rowsById.values()]
  const categoryIds = [...new Set(rows.map((row) => row.category_id).filter((id): id is string => Boolean(id)))]
  const seriesIds = [...new Set(rows.map((row) => row.series_id).filter((id): id is string => Boolean(id)))]
  const [categoryResult, seriesResult] = await Promise.all([
    categoryIds.length ? supabase.from('evo_daily_categories').select('id, name, slug, sort_order').eq('is_active', true).in('id', categoryIds) : Promise.resolve({ data: [], error: null }),
    seriesIds.length ? supabase.from('evo_tv_series').select('id, title, slug, description, thumbnail_url, sort_order').eq('is_active', true).in('id', seriesIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (categoryResult.error) console.error('Unable to resolve related Evo TV categories', { code: categoryResult.error.code, message: categoryResult.error.message })
  if (seriesResult.error) console.error('Unable to resolve related Evo TV series', { code: seriesResult.error.code, message: seriesResult.error.message })
  const categoryMap = new Map(((categoryResult.data ?? []) as CategoryRow[]).map((item) => [item.id, item]))
  const seriesMap = new Map(((seriesResult.data ?? []) as SeriesRow[]).map((item) => [item.id, item]))

  rows.sort((left, right) => {
    const leftSeries = Boolean(video.series && left.series_id === video.series.id)
    const rightSeries = Boolean(video.series && right.series_id === video.series.id)
    const leftCategory = Boolean(video.category && left.category_id === video.category.id)
    const rightCategory = Boolean(video.category && right.category_id === video.category.id)
    return Number(rightSeries) - Number(leftSeries)
      || Number(rightCategory) - Number(leftCategory)
      || effectiveTime(right) - effectiveTime(left)
      || left.sort_order - right.sort_order
      || left.id.localeCompare(right.id)
  })
  return rows.slice(0, 3).map((row) => toSummary(row, categoryMap, seriesMap))
}

export async function getTvLandingData(requestedCategory?: string, page = 1): Promise<TvLandingData> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const publicVideos = () => supabase
    .from('evo_tv_videos')
    .select(videoFields)
    .eq('active', true)
    .or(publicAt(now))

  const [nullPublishedResult, datedPublishedResult, categoryResult, seriesResult] = await Promise.all([
    publicVideos()
      .is('published_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(discoveryCandidateLimit),
    publicVideos()
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(discoveryCandidateLimit),
    supabase
      .from('evo_daily_categories')
      .select('id, name, slug, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('evo_tv_series')
      .select('id, title, slug, description, thumbnail_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })
      .order('id', { ascending: true }),
  ])

  const errors = [nullPublishedResult.error, datedPublishedResult.error, categoryResult.error, seriesResult.error].filter(Boolean)
  if (errors.length) {
    console.error('Unable to load public Evo TV landing data', errors.map((error) => ({ code: error?.code, message: error?.message })))
    return { activeCategory: null, categories: [], featuredVideo: null, videos: [], series: [], hasNextPage: false, hasError: true }
  }

  const rowsById = new Map<string, VideoRow>()
  for (const row of [...(nullPublishedResult.data ?? []), ...(datedPublishedResult.data ?? [])] as VideoRow[]) rowsById.set(row.id, row)
  const rows = [...rowsById.values()].sort(latestFirst)

  const categoryRows = (categoryResult.data ?? []) as CategoryRow[]
  const qualifiedCategoryIds = new Set(rows.map((row) => row.category_id).filter((id): id is string => Boolean(id)))
  const categories = categoryRows
    .filter((category) => qualifiedCategoryIds.has(category.id))
    .map(({ id, name, slug }) => ({ id, name, slug }))
  const activeCategory = categories.find((category) => category.slug === requestedCategory) ?? null
  const categoryMap = new Map(categories.map((category) => [category.id, category]))

  const seriesRows = (seriesResult.data ?? []) as SeriesRow[]
  const qualifiedSeriesIds = new Set(rows.map((row) => row.series_id).filter((id): id is string => Boolean(id)))
  const qualifiedSeries = seriesRows.filter((item) => qualifiedSeriesIds.has(item.id))
  const seriesMap = new Map(qualifiedSeries.map((item) => [item.id, item]))

  const featuredRow = rows.find((row) => row.featured) ?? rows[0]
  const filteredRows = rows.filter((row) => (!activeCategory || row.category_id === activeCategory.id) && row.id !== featuredRow?.id)
  const offset = (page - 1) * tvPageSize
  const pageRows = filteredRows.slice(offset, offset + tvPageSize + 1)

  const series = qualifiedSeries.slice(0, seriesLimit).map((item): TvSeriesSummary => {
    const coverVideo = rows.find((row) => row.series_id === item.id)
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description,
      thumbnailUrl: item.thumbnail_url?.trim() || (coverVideo ? thumbnailFor(coverVideo) : null),
    }
  })

  return {
    activeCategory,
    categories,
    featuredVideo: featuredRow ? toSummary(featuredRow, categoryMap, seriesMap) : null,
    videos: pageRows.slice(0, tvPageSize).map((row) => toSummary(row, categoryMap, seriesMap)),
    series,
    hasNextPage: pageRows.length > tvPageSize,
    hasError: false,
  }
}
