import Link from 'next/link'

import { requireAdmin } from '@/lib/admin-auth'
import { AdminArticleStatus, getAdminDailyArticles } from '@/lib/admin-daily'

const filters: { value: AdminArticleStatus; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' }, { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
]

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default async function AdminDailyPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const requested = (await searchParams).status
  const status = filters.some((filter) => filter.value === requested) ? requested as AdminArticleStatus : 'all'
  const { articles, hasError } = await getAdminDailyArticles(status)

  return (
    <section aria-labelledby="daily-admin-title">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Publishing</p><h1 id="daily-admin-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Evo Daily</h1><p className="mt-3 text-zinc-400">Review and organize the article pipeline.</p></div>
        <Link href="/admin/daily/new" className="bg-amber-300 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-200">New Article</Link>
      </div>

      <nav aria-label="Filter articles by status" className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
        {filters.map((filter) => <Link key={filter.value} href={filter.value === 'all' ? '/admin/daily' : `/admin/daily?status=${filter.value}`} aria-current={status === filter.value ? 'page' : undefined} className={`min-w-max px-4 py-2 text-xs font-semibold uppercase tracking-wider ${status === filter.value ? 'bg-white text-zinc-950' : 'border border-white/10 text-zinc-400 hover:text-white'}`}>{filter.label}</Link>)}
      </nav>

      {hasError ? <div role="alert" className="mt-7 border border-rose-400/30 bg-rose-400/5 p-5 text-sm text-rose-200">Articles could not be loaded right now. Please try again later.</div> : null}
      {!hasError && articles.length === 0 ? (
        <div className="mt-7 grid min-h-72 place-items-center border border-dashed border-white/15 bg-zinc-900/30 px-6 py-14 text-center">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">{status === 'all' ? 'Your newsroom starts here' : `No ${status} articles`}</p><h2 className="mt-3 text-2xl font-semibold">{status === 'all' ? 'Create the first Evo Daily article.' : 'Nothing matches this filter.'}</h2><p className="mx-auto mt-3 max-w-lg leading-7 text-zinc-400">{status === 'all' ? 'Draft, publish, and schedule the first story from the editorial workspace.' : 'Choose another status or begin a new article.'}</p><Link href="/admin/daily/new" className="mt-6 inline-flex bg-amber-300 px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-200">New Article</Link></div>
        </div>
      ) : null}

      {articles.length ? (
        <div className="mt-7 overflow-hidden border border-white/10">
          <div className="hidden grid-cols-[minmax(14rem,2fr)_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-white/10 bg-zinc-900/80 px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500 md:grid">
            <span>Article</span><span>Status</span><span>Category</span><span>Author</span><span>Dates</span><span>Action</span>
          </div>
          <ul className="divide-y divide-white/10">
            {articles.map((article) => (
              <li key={article.id} className="grid gap-4 bg-zinc-950/40 p-5 md:grid-cols-[minmax(14rem,2fr)_1fr_1fr_1fr_1fr_auto] md:items-center">
                <div className="min-w-0"><h2 className="truncate font-semibold text-white">{article.title}</h2><p className="mt-1 truncate text-xs text-zinc-600">/{article.slug}</p>{article.is_featured ? <span className="mt-2 inline-block text-[0.65rem] font-bold uppercase tracking-wider text-amber-300">Featured</span> : null}</div>
                <div><span className={`inline-flex border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${article.displayStatus === 'published' ? 'border-emerald-400/30 text-emerald-300' : article.displayStatus === 'scheduled' ? 'border-sky-400/30 text-sky-300' : 'border-white/15 text-zinc-300'}`}>{article.displayStatus}</span></div>
                <p className="text-sm text-zinc-300"><span className="mr-2 text-xs text-zinc-600 md:hidden">Category</span>{article.categoryName ?? 'Uncategorized'}</p>
                <p className="text-sm text-zinc-300"><span className="mr-2 text-xs text-zinc-600 md:hidden">Author</span>{article.authorName ?? 'Unknown author'}</p>
                <div className="text-xs leading-5 text-zinc-400"><p>{article.published_at ? `Publish: ${formatDate(article.published_at)}` : 'Publish: Not set'}</p><p>Updated: {formatDate(article.updated_at)}</p></div>
                <Link href={`/admin/daily/${article.id}/edit`} className="text-sm font-bold text-amber-300 hover:text-amber-200">Edit</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
