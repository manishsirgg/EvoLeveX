'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { EditorActionState, slugify } from '@/lib/admin-daily-validation'
import { createClient } from '@/lib/supabase/server'

type Intent = 'save' | 'publish' | 'schedule'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function optional(value: string) { return value || null }

function safeFields(formData: FormData) {
  return Object.fromEntries(['title', 'slug', 'excerpt', 'content', 'featured_image_url', 'read_time_minutes',
    'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'category_id', 'new_tags', 'schedule_at']
    .map((key) => [key, text(formData, key)]))
}

function fail(message: string, formData: FormData): EditorActionState {
  return { error: message, fields: safeFields(formData) }
}

function absoluteHttpUrl(value: string) {
  if (!value) return true
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

function revalidateArticle(id: string, oldSlug: string | null, newSlug: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/daily')
  revalidatePath(`/admin/daily/${id}/edit`)
  revalidatePath('/daily')
  revalidatePath(`/daily/${newSlug}`)
  if (oldSlug && oldSlug !== newSlug) revalidatePath(`/daily/${oldSlug}`)
}

async function syncTags(supabase: Awaited<ReturnType<typeof createClient>>, articleId: string, selectedIds: string[], newNames: string[]) {
  const tagIds = new Set(selectedIds)
  const { data: knownTags, error: knownTagsError } = await supabase.from('evo_daily_tags').select('id, name, slug')
  if (knownTagsError) return 'Tags could not be loaded for updating.'
  for (const rawName of newNames) {
    const name = rawName.replace(/\s+/g, ' ').trim()
    const slug = slugify(name)
    if (!name || !slug || name.length > 80) return 'Each new tag needs a meaningful name of 80 characters or fewer.'

    const existing = knownTags?.find((tag) => tag.slug === slug || tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (existing) { tagIds.add(existing.id); continue }

    const { data: created, error } = await supabase.from('evo_daily_tags').insert({ name, slug }).select('id').single()
    if (error || !created) {
      const { data: raced } = await supabase.from('evo_daily_tags').select('id').eq('slug', slug).maybeSingle()
      if (!raced) return 'A tag could not be created. Review the tag names and try again.'
      tagIds.add(raced.id)
    } else tagIds.add(created.id)
  }

  const desired = [...tagIds]
  if (desired.length) {
    const { data: valid, error } = await supabase.from('evo_daily_tags').select('id').in('id', desired)
    if (error || valid?.length !== desired.length) return 'One or more selected tags are no longer available.'
  }

  const { data: current, error: currentError } = await supabase.from('evo_daily_article_tags').select('tag_id').eq('article_id', articleId)
  if (currentError) return 'The article was saved, but its tags could not be loaded for updating.'
  const currentIds = new Set((current ?? []).map(({ tag_id }) => tag_id))
  const toAdd = desired.filter((id) => !currentIds.has(id))
  const toRemove = [...currentIds].filter((id) => !tagIds.has(id))

  if (toAdd.length) {
    const { error } = await supabase.from('evo_daily_article_tags').insert(toAdd.map((tag_id) => ({ article_id: articleId, tag_id })))
    if (error) return 'The article was saved, but some tag changes could not be applied.'
  }
  if (toRemove.length) {
    const { error } = await supabase.from('evo_daily_article_tags').delete().eq('article_id', articleId).in('tag_id', toRemove)
    if (error) return 'The article was saved, but some removed tags could not be detached.'
  }
  return null
}

async function mutateArticle(articleId: string | null, formData: FormData): Promise<EditorActionState> {
  const user = await requireAdmin()
  const supabase = await createClient()
  const intent = text(formData, 'intent') as Intent
  if (!['save', 'publish', 'schedule'].includes(intent)) return fail('Choose a valid publishing action.', formData)

  const title = text(formData, 'title')
  const slug = text(formData, 'slug').toLowerCase()
  const content = String(formData.get('content') ?? '').trim()
  const categoryId = text(formData, 'category_id')
  const readTimeValue = text(formData, 'read_time_minutes')
  const canonicalUrl = text(formData, 'canonical_url')
  const imageUrl = text(formData, 'featured_image_url')
  if (!title) return fail('Title is required.', formData)
  if (!slug || !SLUG.test(slug) || slug.length > 120) return fail('Use a lowercase URL slug with words separated by hyphens.', formData)
  if (!content) return fail('Article body is required.', formData)
  if (readTimeValue && (!/^\d+$/.test(readTimeValue) || Number(readTimeValue) < 1)) return fail('Read time must be a positive whole number.', formData)
  if (!absoluteHttpUrl(canonicalUrl)) return fail('Canonical URL must be an absolute HTTP or HTTPS URL.', formData)
  if (!absoluteHttpUrl(imageUrl)) return fail('Featured image must be an absolute HTTP or HTTPS URL.', formData)
  if (categoryId && !UUID.test(categoryId)) return fail('Choose a valid category.', formData)

  let existing: { status: 'draft' | 'published' | 'archived'; published_at: string | null; category_id: string | null; slug: string } | null = null
  if (articleId) {
    if (!UUID.test(articleId)) return fail('This article could not be found.', formData)
    const result = await supabase.from('evo_daily_articles').select('status, published_at, category_id, slug').eq('id', articleId).maybeSingle()
    if (result.error || !result.data) return fail('This article could not be loaded for editing.', formData)
    existing = result.data
  }

  if (categoryId) {
    const { data } = await supabase.from('evo_daily_categories').select('id, is_active').eq('id', categoryId).maybeSingle()
    if (!data || (!data.is_active && data.id !== existing?.category_id)) return fail('That category is not available for assignment.', formData)
  }

  let status = existing?.status ?? 'draft'
  let publishedAt = existing?.published_at ?? null
  if (intent === 'save' && !existing) { status = 'draft'; publishedAt = null }
  if (intent === 'publish') { status = 'published'; publishedAt = new Date().toISOString() }
  if (intent === 'schedule') {
    const scheduleValue = text(formData, 'schedule_at')
    const scheduleDate = new Date(scheduleValue)
    if (!scheduleValue || Number.isNaN(scheduleDate.valueOf()) || scheduleDate.valueOf() <= Date.now()) {
      return fail('Choose a valid publication time in the future.', formData)
    }
    status = 'published'; publishedAt = scheduleDate.toISOString()
  }
  if (status === 'published' && !publishedAt) return fail('Published articles require a publication time.', formData)

  const keywords = [...new Map(text(formData, 'seo_keywords').split(',').map((item) => item.trim()).filter(Boolean)
    .map((item) => [item.toLocaleLowerCase(), item])).values()]
  const payload = {
    category_id: optional(categoryId), title, slug, excerpt: optional(text(formData, 'excerpt')), content,
    featured_image_url: optional(imageUrl), status, is_featured: formData.get('is_featured') === 'on',
    read_time_minutes: readTimeValue ? Number(readTimeValue) : null, published_at: publishedAt,
    seo_title: optional(text(formData, 'seo_title')), seo_description: optional(text(formData, 'seo_description')),
    seo_keywords: keywords.length ? keywords : null, canonical_url: optional(canonicalUrl),
  }

  const result = articleId
    ? await supabase.from('evo_daily_articles').update(payload).eq('id', articleId).select('id').single()
    : await supabase.from('evo_daily_articles').insert({ ...payload, author_id: user.id }).select('id').single()
  if (result.error || !result.data) {
    if (result.error?.code === '23505') return fail('That slug is already in use. Choose another slug.', formData)
    return fail('The article could not be saved. Please try again.', formData)
  }

  const savedId = result.data.id
  const submittedTagIds = formData.getAll('tag_ids').map(String)
  if (submittedTagIds.some((id) => !UUID.test(id))) return fail('One or more selected tags are invalid.', formData)
  const selectedTagIds = submittedTagIds
  const newTagNames = text(formData, 'new_tags').split(',').filter((name) => name.trim())
  const tagError = await syncTags(supabase, savedId, selectedTagIds, newTagNames)
  revalidateArticle(savedId, existing?.slug ?? null, slug)
  const feedback = tagError ? `warning=${encodeURIComponent(tagError)}` : `success=${intent === 'publish' ? 'published' : intent === 'schedule' ? 'scheduled' : articleId ? 'updated' : 'draft-saved'}`
  redirect(`/admin/daily/${savedId}/edit?${feedback}`)
}

export async function createArticleAction(_state: EditorActionState, formData: FormData) {
  return mutateArticle(null, formData)
}

export async function updateArticleAction(articleId: string, _state: EditorActionState, formData: FormData) {
  return mutateArticle(articleId, formData)
}

export async function archiveArticleAction(articleId: string, _state: EditorActionState, _formData: FormData): Promise<EditorActionState> {
  void _state
  void _formData
  await requireAdmin()
  if (!UUID.test(articleId)) return { error: 'This article could not be found.' }
  const supabase = await createClient()
  const { data: article } = await supabase.from('evo_daily_articles').select('slug').eq('id', articleId).maybeSingle()
  if (!article) return { error: 'This article could not be found.' }
  const { error } = await supabase.from('evo_daily_articles').update({ status: 'archived' }).eq('id', articleId)
  if (error) return { error: 'The article could not be archived. Please try again.' }
  revalidateArticle(articleId, article.slug, article.slug)
  redirect(`/admin/daily/${articleId}/edit?success=archived`)
}
