import { createClient } from '@/lib/supabase/server'
import { TvOption, TvVideo } from '@/lib/admin-tv-shared'

export type { TvOption, TvVideo } from '@/lib/admin-tv-shared'

export type TvFilter = 'all' | 'public' | 'scheduled' | 'hidden' | 'featured'

const fields = 'id, series_id, category_id, youtube_video_id, title, slug, description, thumbnail_url, duration_seconds, featured, active, sort_order, published_at, seo_title, seo_description, created_at, updated_at'

export async function getTvOptions(selectedCategory?: string | null, selectedSeries?: string | null) {
  const supabase = await createClient()
  const [categories, series] = await Promise.all([
    supabase.from('evo_daily_categories').select('id, name, is_active').or(selectedCategory ? `is_active.eq.true,id.eq.${selectedCategory}` : 'is_active.eq.true').order('name'),
    supabase.from('evo_tv_series').select('id, title, is_active').or(selectedSeries ? `is_active.eq.true,id.eq.${selectedSeries}` : 'is_active.eq.true').order('sort_order').order('title'),
  ])
  return {
    categories: (categories.data ?? []).map((x) => ({ id: x.id, label: x.name, active: x.is_active })) as TvOption[],
    series: (series.data ?? []).map((x) => ({ id: x.id, label: x.title, active: x.is_active })) as TvOption[],
    hasError: Boolean(categories.error || series.error),
  }
}

export async function getAdminTvVideos(filter: TvFilter, categoryId?: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()
  let query = supabase.from('evo_tv_videos').select(fields).order('updated_at', { ascending: false })
  if (filter === 'hidden') query = query.eq('active', false)
  if (filter === 'scheduled') query = query.eq('active', true).gt('published_at', now)
  if (filter === 'public') query = query.eq('active', true).or(`published_at.is.null,published_at.lte.${now}`)
  if (filter === 'featured') query = query.eq('featured', true)
  if (categoryId) query = query.eq('category_id', categoryId)
  const result = await query
  const videos = (result.data ?? []) as TvVideo[]
  const categoryIds = [...new Set(videos.flatMap((v) => v.category_id ? [v.category_id] : []))]
  const seriesIds = [...new Set(videos.flatMap((v) => v.series_id ? [v.series_id] : []))]
  const [categories, series] = await Promise.all([
    categoryIds.length ? supabase.from('evo_daily_categories').select('id, name').in('id', categoryIds) : Promise.resolve({ data: [], error: null }),
    seriesIds.length ? supabase.from('evo_tv_series').select('id, title').in('id', seriesIds) : Promise.resolve({ data: [], error: null }),
  ])
  return { videos, categories: new Map((categories.data ?? []).map(x => [x.id, x.name])), series: new Map((series.data ?? []).map(x => [x.id, x.title])), hasError: Boolean(result.error || categories.error || series.error) }
}

export async function getTvVideo(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('evo_tv_videos').select(fields).eq('id', id).maybeSingle()
  return data as TvVideo | null
}
