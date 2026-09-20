import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ArticleCard } from '@/components/daily/article-card'
import type { DailyArticleSummary, DailyCategory } from '@/lib/daily'
import { createClient } from '@/lib/supabase/server'

type BookmarkRow = { article_id: string; created_at: string }
type ArticleRow = Omit<DailyArticleSummary, 'category'>

const savedArticleFields = 'id, category_id, title, slug, excerpt, featured_image_url, is_featured, read_time_minutes, published_at'

export default async function SavedArticlesPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect('/auth/login')

  const { data: bookmarkData, error: bookmarkError } = await supabase
    .from('evo_daily_bookmarks')
    .select('article_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const bookmarks = (bookmarkData ?? []) as BookmarkRow[]
  const articleIds = bookmarks.map((bookmark) => bookmark.article_id)
  const { data: articleData, error: articleError } = articleIds.length
    ? await supabase
      .from('evo_daily_articles')
      .select(savedArticleFields)
      .in('id', articleIds)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
    : { data: [], error: null }

  const articleRows = (articleData ?? []) as unknown as ArticleRow[]
  const categoryIds = [...new Set(articleRows.map((article) => article.category_id).filter((id): id is string => Boolean(id)))]
  const { data: categoryData, error: categoryError } = categoryIds.length
    ? await supabase.from('evo_daily_categories').select('id, name, slug').in('id', categoryIds)
    : { data: [], error: null }
  const categories = new Map(((categoryData ?? []) as DailyCategory[]).map((category) => [category.id, category]))
  const articleById = new Map(articleRows.map((article) => [article.id, { ...article, category: article.category_id ? categories.get(article.category_id) ?? null : null }]))
  const articles = articleIds.flatMap((id) => articleById.get(id) ?? [])
  const hasError = Boolean(bookmarkError || articleError || categoryError)

  return (
    <section aria-labelledby="saved-title" className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Your reading list</p>
        <h1 id="saved-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Saved Articles</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">Keep the Evo Daily stories you want to return to in one place.</p>
      </div>

      {hasError ? (
        <div role="alert" className="border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm leading-6 text-amber-100">
          Your saved articles could not be loaded right now. Refresh the page to try again.
        </div>
      ) : articles.length ? (
        <div className="article-grid account-saved-grid">{articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div>
      ) : (
        <div className="border border-white/10 bg-zinc-900/40 p-8 sm:p-10">
          <h2 className="text-xl font-semibold text-white">Your reading list is ready.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">Save an article from Evo Daily and it will appear here for easy access.</p>
          <Link href="/daily" className="button-light mt-6 inline-flex px-5 py-3 text-sm">Explore Evo Daily</Link>
        </div>
      )}
    </section>
  )
}
