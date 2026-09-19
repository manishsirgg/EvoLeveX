import { createClient } from '@/lib/supabase/server'
import { DailyBlock, EvoTvVideo, StoreProduct, VaultProduct } from '@/lib/daily-blocks'
import { getArticleBlocks } from '@/lib/daily-block-data'
import { DailyArticle } from '@/lib/daily'

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
export type BlockComposerData = { blocks: DailyBlock[]; videos: EvoTvVideo[]; vaultProducts: VaultProduct[]; storeProducts: StoreProduct[]; hasError: boolean }

export async function getBlockComposerData(articleId: string): Promise<BlockComposerData> {
  const supabase = await createClient()
  const [blockResult, videos, vault, store] = await Promise.all([
    getArticleBlocks(articleId, true),
    supabase.from('evo_tv_videos').select('id, youtube_video_id, title, description, thumbnail_url, duration_seconds, slug, is_active, published_at').eq('is_active', true).order('title'),
    supabase.from('evo_vault_products').select('id, kind, name, slug, short_description, description, price, currency, cover_image_url, is_active').eq('is_active', true).order('name'),
    supabase.from('evo_store_products').select('id, name, slug, short_description, base_price, currency, cover_image_url, is_active').eq('is_active', true).order('name'),
  ])
  return { blocks: blockResult.blocks, videos: (videos.data ?? []) as EvoTvVideo[], vaultProducts: (vault.data ?? []) as VaultProduct[], storeProducts: (store.data ?? []) as StoreProduct[], hasError: blockResult.hasError || Boolean(videos.error || vault.error || store.error) }
}

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

export async function getAdminPreviewArticle(id: string): Promise<DailyArticle | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('evo_daily_articles').select('id, category_id, author_id, title, slug, excerpt, content, featured_image_url, status, is_featured, read_time_minutes, published_at, seo_title, seo_description, seo_keywords, canonical_url').eq('id', id).maybeSingle()
  if (error || !data) return null
  const [category, author, links] = await Promise.all([
    data.category_id ? supabase.from('evo_daily_categories').select('id, name, slug').eq('id', data.category_id).maybeSingle() : Promise.resolve({ data: null }),
    data.author_id ? supabase.from('profiles').select('username, display_name').eq('id', data.author_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('evo_daily_article_tags').select('tag_id').eq('article_id', id),
  ])
  const tagIds = (links.data ?? []).map(({ tag_id }) => tag_id)
  const tags = tagIds.length ? await supabase.from('evo_daily_tags').select('id, name, slug').in('id', tagIds).order('name') : { data: [] }
  return { ...data, category: category.data, author: author.data, tags: tags.data ?? [] } as unknown as DailyArticle
}
