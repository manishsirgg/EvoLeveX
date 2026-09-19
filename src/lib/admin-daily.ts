import { createClient } from '@/lib/supabase/server'

export type AdminArticleStatus = 'all' | 'draft' | 'published' | 'scheduled' | 'archived'

type ArticleRow = {
  id: string
  author_id: string | null
  category_id: string | null
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  is_featured: boolean
  published_at: string | null
  updated_at: string
}

export type AdminArticle = ArticleRow & {
  categoryName: string | null
  authorName: string | null
  displayStatus: Exclude<AdminArticleStatus, 'all'>
}

export type AdminDailyStats = Record<Exclude<AdminArticleStatus, 'all'> | 'total', number>

const articleFields = 'id, author_id, category_id, title, slug, status, is_featured, published_at, updated_at'

export async function getAdminDailyStats(): Promise<{ stats: AdminDailyStats | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_daily_articles')
    .select('status, published_at')

  if (error) return { stats: null }

  const now = Date.now()
  const stats: AdminDailyStats = { total: 0, draft: 0, published: 0, scheduled: 0, archived: 0 }

  for (const article of data ?? []) {
    stats.total += 1
    if (article.status === 'published' && article.published_at && Date.parse(article.published_at) > now) {
      stats.scheduled += 1
    } else if (article.status in stats) {
      stats[article.status as 'draft' | 'published' | 'archived'] += 1
    }
  }

  return { stats }
}

export async function getAdminDailyArticles(status: AdminArticleStatus) {
  const supabase = await createClient()
  const now = new Date().toISOString()
  let query = supabase.from('evo_daily_articles').select(articleFields).order('updated_at', { ascending: false })

  if (status === 'scheduled') query = query.eq('status', 'published').gt('published_at', now)
  if (status === 'published') {
    query = query.eq('status', 'published').or(`published_at.is.null,published_at.lte.${now}`)
  }
  if (status === 'draft' || status === 'archived') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return { articles: [] as AdminArticle[], hasError: true }

  const rows = (data ?? []) as ArticleRow[]
  const categoryIds = [...new Set(rows.flatMap((row) => row.category_id ? [row.category_id] : []))]
  const authorIds = [...new Set(rows.flatMap((row) => row.author_id ? [row.author_id] : []))]
  const [categoryResult, authorResult] = await Promise.all([
    categoryIds.length
      ? supabase.from('evo_daily_categories').select('id, name').in('id', categoryIds)
      : Promise.resolve({ data: [], error: null }),
    authorIds.length
      ? supabase.from('profiles').select('id, display_name, username').in('id', authorIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const categories = new Map((categoryResult.data ?? []).map((item) => [item.id, item.name]))
  const authors = new Map((authorResult.data ?? []).map((item) => [item.id, item.display_name || item.username]))

  return {
    articles: rows.map((article) => ({
      ...article,
      categoryName: article.category_id ? categories.get(article.category_id) ?? null : null,
      authorName: article.author_id ? authors.get(article.author_id) ?? null : null,
      displayStatus: article.status === 'published' && article.published_at && Date.parse(article.published_at) > Date.now()
        ? 'scheduled' as const
        : article.status,
    })),
    hasError: Boolean(categoryResult.error || authorResult.error),
  }
}
