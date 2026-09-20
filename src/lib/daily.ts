import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

export type DailyCategory = { id: string; name: string; slug: string }
type CategoryRow = DailyCategory & { sort_order: number | null }

export type DailyArticleSummary = {
  id: string
  category_id: string | null
  title: string
  slug: string
  excerpt: string | null
  featured_image_url: string | null
  is_featured: boolean
  read_time_minutes: number | null
  published_at: string | null
  category: DailyCategory | null
}

type ArticleRow = Omit<DailyArticleSummary, 'category'> & {
  author_id?: string | null
  content?: string | null
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string[] | string | null
  canonical_url?: string | null
}

type Author = { username: string | null; display_name: string | null }
type Tag = { id: string; name: string; slug: string }

export type DailyArticle = ArticleRow & {
  author_id: string | null
  content: string | null
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string[] | string | null
  canonical_url: string | null
  category: DailyCategory | null
  author: Author | null
  tags: Tag[]
}

const articleSummaryFields = 'id, category_id, title, slug, excerpt, featured_image_url, is_featured, read_time_minutes, published_at'
const articleDetailFields = `${articleSummaryFields}, author_id, content, seo_title, seo_description, seo_keywords, canonical_url`
const relatedArticleLimit = 3
const relatedTagRelationshipLimit = 300

type ArticleTagRow = { article_id: string; tag_id: string }

export async function getDailyLandingData(requestedCategory?: string) {
  const supabase = await createClient()
  const { data: categoryData, error: categoryError } = await supabase
    .from('evo_daily_categories')
    .select('id, name, slug, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  const categoryRows = (categoryData ?? []) as CategoryRow[]
  const categories = categoryRows.map(({ id, name, slug }) => ({ id, name, slug }))
  const activeCategory = categories.find((category) => category.slug === requestedCategory)

  let query = supabase
    .from('evo_daily_articles')
    .select(articleSummaryFields)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })

  if (activeCategory) query = query.eq('category_id', activeCategory.id)
  const { data: articleData, error: articleError } = await query

  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const articles = ((articleData ?? []) as unknown as ArticleRow[]).map((article) => ({
    ...article,
    category: article.category_id ? categoryMap.get(article.category_id) ?? null : null,
  }))

  return { articles, categories, hasError: Boolean(categoryError || articleError) }
}

export const getDailyArticle = cache(async (slug: string): Promise<DailyArticle | null> => {
  if (!slug.trim()) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_daily_articles')
    .select(articleDetailFields)
    .eq('slug', slug)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null
  const row = data as unknown as ArticleRow

  const [categoryResult, authorResult, relationshipResult] = await Promise.all([
    row.category_id
      ? supabase.from('evo_daily_categories').select('id, name, slug').eq('id', row.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.author_id
      ? supabase.from('profiles').select('username, display_name').eq('id', row.author_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('evo_daily_article_tags').select('tag_id').eq('article_id', row.id),
  ])

  const tagIds = (relationshipResult.data ?? []).map((item: { tag_id: string }) => item.tag_id)
  const tagResult = tagIds.length
    ? await supabase.from('evo_daily_tags').select('id, name, slug').in('id', tagIds).order('name')
    : { data: [] }

  return {
    ...row,
    author_id: row.author_id ?? null,
    content: row.content ?? null,
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
    seo_keywords: row.seo_keywords ?? null,
    canonical_url: row.canonical_url ?? null,
    category: categoryResult.data as DailyCategory | null,
    author: authorResult.data as Author | null,
    tags: (tagResult.data ?? []) as Tag[],
  }
})

export async function getRelatedDailyArticles(article: DailyArticle): Promise<DailyArticleSummary[]> {
  const supabase = await createClient()
  const publishedBefore = new Date().toISOString()
  const tagIds = article.tags.map((tag) => tag.id)

  const { data: relationshipData, error: relationshipError } = tagIds.length
    ? await supabase
      .from('evo_daily_article_tags')
      .select('article_id, tag_id')
      .in('tag_id', tagIds)
      .neq('article_id', article.id)
      .order('article_id', { ascending: true })
      .order('tag_id', { ascending: true })
      .limit(relatedTagRelationshipLimit)
    : { data: [], error: null }

  const relationships = (relationshipData ?? []) as ArticleTagRow[]
  const sharedTagCounts = new Map<string, number>()
  if (!relationshipError) {
    for (const relationship of relationships) {
      sharedTagCounts.set(relationship.article_id, (sharedTagCounts.get(relationship.article_id) ?? 0) + 1)
    }
  }

  const taggedArticleIds = [...sharedTagCounts.keys()]
  const publicArticles = () => supabase
    .from('evo_daily_articles')
    .select(articleSummaryFields)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .lte('published_at', publishedBefore)
    .neq('id', article.id)

  const [taggedResult, categoryResult, recentResult] = await Promise.all([
    taggedArticleIds.length
      ? publicArticles().in('id', taggedArticleIds).limit(relatedTagRelationshipLimit)
      : Promise.resolve({ data: [], error: null }),
    article.category_id
      ? publicArticles()
        .eq('category_id', article.category_id)
        .order('published_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(relatedArticleLimit)
      : Promise.resolve({ data: [], error: null }),
    publicArticles()
      .order('published_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(relatedArticleLimit),
  ])

  const candidates = new Map<string, ArticleRow>()
  for (const row of [...(taggedResult.data ?? []), ...(categoryResult.data ?? []), ...(recentResult.data ?? [])] as unknown as ArticleRow[]) {
    candidates.set(row.id, row)
  }

  const ranked = [...candidates.values()]
    .sort((left, right) => {
      const tagDifference = (sharedTagCounts.get(right.id) ?? 0) - (sharedTagCounts.get(left.id) ?? 0)
      if (tagDifference) return tagDifference
      const categoryDifference = Number(right.category_id === article.category_id && article.category_id !== null)
        - Number(left.category_id === article.category_id && article.category_id !== null)
      if (categoryDifference) return categoryDifference
      const dateDifference = Date.parse(right.published_at ?? '') - Date.parse(left.published_at ?? '')
      return dateDifference || left.id.localeCompare(right.id)
    })
    .slice(0, relatedArticleLimit)

  const categoryIds = [...new Set(ranked.map((candidate) => candidate.category_id).filter((id): id is string => Boolean(id)))]
  const { data: categoryData } = categoryIds.length
    ? await supabase.from('evo_daily_categories').select('id, name, slug').in('id', categoryIds)
    : { data: [] }
  const categories = new Map(((categoryData ?? []) as DailyCategory[]).map((category) => [category.id, category]))

  return ranked.map((candidate) => ({
    ...candidate,
    category: candidate.category_id ? categories.get(candidate.category_id) ?? null : null,
  }))
}

export function normalizeKeywords(value: string[] | string | null) {
  if (Array.isArray(value)) return value.map((keyword) => keyword.trim()).filter(Boolean)
  return value?.split(',').map((keyword) => keyword.trim()).filter(Boolean)
}

export function validCanonicalUrl(value: string | null) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function articleCanonicalUrl(slug: string, canonicalUrl: string | null) {
  return validCanonicalUrl(canonicalUrl) ?? `https://evolevex.com/daily/${encodeURIComponent(slug)}`
}
