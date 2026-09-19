import { createClient } from '@/lib/supabase/server'

export type ArticleStatus = 'draft' | 'published' | 'archived'

export type EditorArticle = {
  id: string
  category_id: string | null
  title: string
  slug: string
  excerpt: string | null
  content: string
  featured_image_url: string | null
  status: ArticleStatus
  is_featured: boolean
  read_time_minutes: number | null
  published_at: string | null
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string[] | null
  canonical_url: string | null
  tagIds: string[]
}

export type EditorCategory = { id: string; name: string; is_active: boolean }
export type EditorTag = { id: string; name: string; slug: string }

export async function getEditorOptions(currentCategoryId?: string | null) {
  const supabase = await createClient()
  const [categoryResult, tagResult] = await Promise.all([
    supabase.from('evo_daily_categories').select('id, name, is_active, sort_order')
      .or(currentCategoryId ? `is_active.eq.true,id.eq.${currentCategoryId}` : 'is_active.eq.true')
      .order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('evo_daily_tags').select('id, name, slug').order('name', { ascending: true }),
  ])

  return {
    categories: (categoryResult.data ?? []) as EditorCategory[],
    tags: (tagResult.data ?? []) as EditorTag[],
    hasError: Boolean(categoryResult.error || tagResult.error),
  }
}

export async function getEditorArticle(id: string): Promise<EditorArticle | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('evo_daily_articles').select([
    'id', 'category_id', 'title', 'slug', 'excerpt', 'content', 'featured_image_url', 'status',
    'is_featured', 'read_time_minutes', 'published_at', 'seo_title', 'seo_description',
    'seo_keywords', 'canonical_url',
  ].join(', ')).eq('id', id).maybeSingle()
  if (error || !data) return null

  const { data: relationships, error: tagError } = await supabase
    .from('evo_daily_article_tags').select('tag_id').eq('article_id', id)
  if (tagError) return null

  const article = data as unknown as Omit<EditorArticle, 'tagIds'>
  return { ...article, tagIds: (relationships ?? []).map(({ tag_id }) => tag_id) }
}
