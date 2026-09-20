'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { extractYoutubeId, TvActionState } from '@/lib/admin-tv-validation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const optional = (value: string) => value || null
const safeFields = (data: FormData) => Object.fromEntries(['youtube_video_id','title','slug','description','thumbnail_url','category_id','series_id','duration_seconds','sort_order','published_at','seo_title','seo_description'].map(k => [k, text(data, k)]))
const fail = (error: string, data: FormData): TvActionState => ({ error, fields: safeFields(data) })
function validUrl(value: string) { if (!value) return true; try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }

async function mutateVideo(id: string | null, data: FormData): Promise<TvActionState> {
  await requireAdmin()
  const supabase = await createClient()
  const intent = text(data, 'intent') || 'save'
  if (!['save', 'public', 'schedule', 'hide'].includes(intent)) return fail('Choose a valid publishing action.', data)
  const youtubeId = extractYoutubeId(text(data, 'youtube_video_id'))
  const title = text(data, 'title'); const slug = text(data, 'slug').toLowerCase()
  const categoryId = text(data, 'category_id'); const seriesId = text(data, 'series_id')
  if (!youtubeId) return fail('Enter a valid 11-character YouTube ID or supported YouTube URL.', data)
  if (!title) return fail('Title is required.', data)
  if (!slug || !SLUG.test(slug) || slug.length > 160) return fail('Use a lowercase slug with words separated by hyphens.', data)
  if ((categoryId && !UUID.test(categoryId)) || (seriesId && !UUID.test(seriesId))) return fail('Choose valid category and series options.', data)
  const durationRaw = text(data, 'duration_seconds'); const duration = durationRaw ? Number(durationRaw) : null
  const sortRaw = text(data, 'sort_order') || '0'; const sortOrder = Number(sortRaw)
  if (durationRaw && (!/^\d+$/.test(durationRaw) || !Number.isSafeInteger(duration) || duration! < 0)) return fail('Duration must be a non-negative whole number of seconds.', data)
  if (!/^-?\d+$/.test(sortRaw) || !Number.isSafeInteger(sortOrder)) return fail('Sort order must be a whole number.', data)
  if (!validUrl(text(data, 'thumbnail_url'))) return fail('Thumbnail URL must be an absolute HTTP or HTTPS URL.', data)
  let active = data.get('active') === 'on'; let publishedAt = optional(text(data, 'published_at'))
  if (publishedAt && Number.isNaN(Date.parse(publishedAt))) return fail('Choose a valid publication date.', data)
  if (intent === 'public') { active = true; publishedAt = null }
  if (intent === 'hide') active = false
  if (intent === 'schedule') {
    if (!publishedAt || Date.parse(publishedAt) <= Date.now()) return fail('Choose a publication time in the future.', data)
    active = true
  }
  if (publishedAt) publishedAt = new Date(publishedAt).toISOString()
  for (const [table, optionId] of [['evo_daily_categories', categoryId], ['evo_tv_series', seriesId]] as const) {
    if (optionId) { const { data: option } = await supabase.from(table).select('id').eq('id', optionId).maybeSingle(); if (!option) return fail('A selected category or series is unavailable.', data) }
  }
  const payload = { youtube_video_id: youtubeId, title, slug, description: optional(text(data,'description')), thumbnail_url: optional(text(data,'thumbnail_url')), category_id: optional(categoryId), series_id: optional(seriesId), duration_seconds: duration, featured: data.get('featured') === 'on', active, sort_order: sortOrder, published_at: publishedAt, seo_title: optional(text(data,'seo_title')), seo_description: optional(text(data,'seo_description')), updated_at: new Date().toISOString() }
  const result = id ? await supabase.from('evo_tv_videos').update(payload).eq('id', id).select('id').single() : await supabase.from('evo_tv_videos').insert(payload).select('id').single()
  if (result.error || !result.data) return fail(result.error?.code === '23505' ? 'That slug or YouTube video ID is already in use.' : 'The video could not be saved. Please try again.', data)
  revalidatePath('/admin/tv'); revalidatePath(`/admin/tv/${result.data.id}/edit`)
  redirect(`/admin/tv/${result.data.id}/edit?success=${intent}`)
}
export async function createVideoAction(_state: TvActionState, data: FormData) { return mutateVideo(null, data) }
export async function updateVideoAction(id: string, _state: TvActionState, data: FormData) { return mutateVideo(id, data) }

async function mutateSeries(id: string | null, data: FormData): Promise<TvActionState> {
  await requireAdmin(); const supabase = await createClient()
  const title = text(data, 'title'); const slug = text(data, 'slug').toLowerCase(); const sortRaw = text(data, 'sort_order') || '0'; const sortOrder = Number(sortRaw)
  if (!title) return fail('Title is required.', data)
  if (!slug || !SLUG.test(slug) || slug.length > 160) return fail('Use a lowercase slug with words separated by hyphens.', data)
  if (!/^-?\d+$/.test(sortRaw) || !Number.isSafeInteger(sortOrder)) return fail('Sort order must be a whole number.', data)
  if (!validUrl(text(data, 'thumbnail_url'))) return fail('Thumbnail URL must be an absolute HTTP or HTTPS URL.', data)
  const payload = { title, slug, description: optional(text(data,'description')), thumbnail_url: optional(text(data,'thumbnail_url')), sort_order: sortOrder, is_active: data.get('is_active') === 'on', updated_at: new Date().toISOString() }
  const result = id ? await supabase.from('evo_tv_series').update(payload).eq('id', id).select('id').single() : await supabase.from('evo_tv_series').insert(payload).select('id').single()
  if (result.error || !result.data) return fail(result.error?.code === '23505' ? 'That series slug is already in use.' : 'The series could not be saved.', data)
  revalidatePath('/admin/tv/series'); redirect(`/admin/tv/series/${result.data.id}/edit?success=saved`)
}
export async function createSeriesAction(_state: TvActionState, data: FormData) { return mutateSeries(null, data) }
export async function updateSeriesAction(id: string, _state: TvActionState, data: FormData) { return mutateSeries(id, data) }
