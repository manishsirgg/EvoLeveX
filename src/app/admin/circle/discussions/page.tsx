import Link from 'next/link'

import { requireAdmin } from '@/lib/admin-auth'
import {
  CIRCLE_DISCUSSION_PAGE_SIZE,
  CircleDiscussionFilter,
  circleAuthorName,
  getAdminCircleDiscussions,
  getCircleTopicOptions,
} from '@/lib/admin-circle-discussions'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const filters: { value: CircleDiscussionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'removed', label: 'Removed' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'locked', label: 'Locked' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function hrefFor(values: { filter: CircleDiscussionFilter; topic: string | null; q: string; page?: number }) {
  const params = new URLSearchParams()
  if (values.filter !== 'all') params.set('filter', values.filter)
  if (values.topic) params.set('topic', values.topic)
  if (values.q) params.set('q', values.q)
  if (values.page && values.page > 1) params.set('page', String(values.page))
  const query = params.toString()
  return `/admin/circle/discussions${query ? `?${query}` : ''}`
}

export default async function CircleDiscussionsPage({ searchParams }: {
  searchParams: Promise<{ filter?: string; topic?: string; q?: string; page?: string; error?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const filter = filters.some((item) => item.value === params.filter) ? params.filter as CircleDiscussionFilter : 'all'
  const topic = params.topic && UUID.test(params.topic) ? params.topic : null
  const q = (params.q ?? '').trim().slice(0, 80)
  const requestedPage = Number(params.page)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [result, topicResult] = await Promise.all([
    getAdminCircleDiscussions({ filter, topicId: topic, search: q, page }),
    getCircleTopicOptions(),
  ])
  const pageCount = Math.max(1, Math.ceil(result.count / CIRCLE_DISCUSSION_PAGE_SIZE))
  const filtered = filter !== 'all' || Boolean(topic || q)

  return (
    <section aria-labelledby="circle-discussions-title">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Circle · Moderation</p>
          <h1 id="circle-discussions-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Discussions</h1>
          <p className="mt-3 text-zinc-400">Review community conversations and their moderation state.</p>
        </div>
        <Link href="/admin/circle" className="button-secondary px-4 py-3 text-sm font-bold">Circle overview</Link>
      </div>

      <nav aria-label="Filter discussions by state" className="admin-filter-nav mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
        {filters.map((item) => (
          <Link key={item.value} href={hrefFor({ filter: item.value, topic, q })} aria-current={filter === item.value ? 'page' : undefined} className="min-w-max px-4 py-2 text-xs uppercase tracking-wider">{item.label}</Link>
        ))}
      </nav>

      <form action="/admin/circle/discussions" className="mt-5 grid gap-4 border border-white/10 bg-zinc-900/40 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_auto] sm:items-end">
        {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Title or slug
          <input name="q" defaultValue={q} maxLength={80} placeholder="Search discussions" className="mt-2 w-full border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300" />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Topic
          <select name="topic" defaultValue={topic ?? ''} className="mt-2 w-full border border-white/15 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-amber-300">
            <option value="">All topics</option>
            {topicResult.topics.map((item) => <option key={item.id} value={item.id}>{item.icon ? `${item.icon} ` : ''}{item.name}</option>)}
          </select>
        </label>
        <button type="submit" className="button-primary px-5 py-2.5 text-sm">Apply filters</button>
      </form>

      {params.error ? <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-5 text-rose-200">The requested discussion could not be updated or found. Please try again.</p> : null}
      {result.hasError || topicResult.hasError ? <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-5 text-rose-200">Discussions could not be loaded completely right now. Please try again later.</p> : null}

      {!result.hasError && result.discussions.length === 0 ? (
        <div className="mt-7 grid min-h-64 place-items-center border border-dashed border-white/15 bg-zinc-900/30 px-6 py-14 text-center">
          <div><h2 className="text-2xl font-semibold">{filtered ? 'No discussions match these filters.' : 'No discussions yet.'}</h2><p className="mx-auto mt-3 max-w-lg leading-7 text-zinc-400">{filtered ? 'Adjust the state, topic, or search to broaden the results.' : 'Member discussions will appear here when the community starts a conversation.'}</p>{filtered ? <Link href="/admin/circle/discussions" className="button-secondary mt-6 px-5 py-3 text-sm font-bold">Clear filters</Link> : null}</div>
        </div>
      ) : null}

      {result.discussions.length ? (
        <div className="mt-7 overflow-hidden border border-white/10">
          <p className="border-b border-white/10 bg-zinc-900/80 px-5 py-3 text-xs text-zinc-400"><span className="font-semibold text-white">{result.count}</span> matching discussion{result.count === 1 ? '' : 's'} · page {page} of {pageCount}</p>
          <ul className="divide-y divide-white/10">
            {result.discussions.map((discussion) => (
              <li key={discussion.id} className="grid gap-5 bg-zinc-950/40 p-5 xl:grid-cols-[minmax(16rem,2fr)_minmax(11rem,1fr)_minmax(13rem,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    {discussion.pinned ? <span className="border border-amber-300/30 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-amber-300">Pinned</span> : null}
                    {discussion.locked ? <span className="border border-sky-300/30 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-sky-200">Replies locked</span> : null}
                    <span className={`border px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${discussion.status === 'published' ? 'border-emerald-400/30 text-emerald-300' : discussion.status === 'removed' ? 'border-rose-400/30 text-rose-200' : 'border-violet-400/30 text-violet-200'}`}>{discussion.status === 'locked' ? 'Legacy status: locked' : discussion.status}</span>
                  </div>
                  <h2 className="mt-3 break-words font-semibold text-white">{discussion.title}</h2>
                  <p className="mt-1 break-all text-xs text-zinc-500">/{discussion.slug}</p>
                </div>
                <div className="text-sm leading-6 text-zinc-300"><p>{discussion.topic?.icon ? <span aria-hidden="true">{discussion.topic.icon} </span> : null}{discussion.topic?.name ?? 'No topic'}</p><p className="text-zinc-500">{circleAuthorName(discussion.author)}</p></div>
                <div className="text-xs leading-6 text-zinc-400"><p>{discussion.replyCount} replies · {discussion.likeCount} likes · {discussion.view_count} views</p><p>Created {formatDate(discussion.created_at)}</p><p>Updated {formatDate(discussion.updated_at)}</p></div>
                <Link href={`/admin/circle/discussions/${discussion.id}`} className="button-secondary px-4 py-2.5 text-sm font-bold">Review</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.discussions.length ? <nav aria-label="Discussion pages" className="mt-6 flex items-center justify-between gap-4"><div>{page > 1 ? <Link href={hrefFor({ filter, topic, q, page: page - 1 })} className="button-secondary px-4 py-2.5 text-sm font-bold">← Previous</Link> : null}</div><p className="text-sm text-zinc-500">Page {page} of {pageCount}</p><div>{page < pageCount ? <Link href={hrefFor({ filter, topic, q, page: page + 1 })} className="button-secondary px-4 py-2.5 text-sm font-bold">Next →</Link> : null}</div></nav> : null}
    </section>
  )
}
