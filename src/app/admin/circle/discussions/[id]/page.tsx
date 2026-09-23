import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { circleAuthorName, getAdminCircleDiscussion } from '@/lib/admin-circle-discussions'
import { removeDiscussion, restoreDiscussion, setDiscussionLocked, setDiscussionPinned } from '../actions'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}

export default async function CircleDiscussionDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const [{ success, error }, result] = await Promise.all([searchParams, getAdminCircleDiscussion(id)])
  if (!result.discussion && !result.hasError) notFound()

  if (!result.discussion) return <section><p role="alert" className="border border-rose-400/30 bg-rose-400/5 p-5 text-rose-200">This discussion could not be loaded right now. Please try again later.</p><Link href="/admin/circle/discussions" className="button-secondary mt-5 px-4 py-3 text-sm font-bold">Back to discussions</Link></section>
  const discussion = result.discussion

  return (
    <article aria-labelledby="discussion-title">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Circle · Discussion review</p>
          <h1 id="discussion-title" className="mt-3 max-w-4xl break-words text-3xl font-semibold tracking-tight sm:text-4xl">{discussion.title}</h1>
          <p className="mt-2 break-all text-sm text-zinc-500">/{discussion.slug}</p>
        </div>
        <Link href="/admin/circle/discussions" className="button-secondary px-4 py-3 text-sm font-bold">Back to discussions</Link>
      </div>

      {success ? <p role="status" className="mt-6 border border-emerald-400/30 bg-emerald-400/5 p-4 text-emerald-200">Discussion moderation state updated.</p> : null}
      {error ? <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-4 text-rose-200">The discussion could not be updated. Please try again.</p> : null}
      {result.hasError ? <p role="alert" className="mt-6 border border-amber-300/30 bg-amber-300/5 p-4 text-amber-100">Some related discussion information could not be loaded. Refresh to try again.</p> : null}

      <section aria-labelledby="state-heading" className="mt-7 border border-white/10 bg-zinc-900/40 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Moderation state</p><h2 id="state-heading" className="mt-2 text-xl font-semibold">Controls</h2></div>
          <div className="flex flex-wrap gap-2" aria-label="Current discussion state">
            <span className={`border px-2.5 py-1 text-xs font-bold uppercase ${discussion.status === 'published' ? 'border-emerald-400/30 text-emerald-300' : discussion.status === 'removed' ? 'border-rose-400/30 text-rose-200' : 'border-violet-400/30 text-violet-200'}`}>{discussion.status === 'locked' ? 'Legacy status: locked' : discussion.status}</span>
            <span className="border border-white/15 px-2.5 py-1 text-xs font-bold uppercase text-zinc-300">{discussion.pinned ? 'Pinned' : 'Not pinned'}</span>
            <span className="border border-white/15 px-2.5 py-1 text-xs font-bold uppercase text-zinc-300">{discussion.locked ? 'Replies locked' : 'Replies open'}</span>
          </div>
        </div>
        {discussion.status === 'locked' ? <p className="mt-5 border border-violet-400/20 bg-violet-400/5 p-4 text-sm leading-6 text-violet-100">This row uses the legacy locked status. Reply locking is now controlled separately. Choose Remove or Restore only when you intend to set its visibility explicitly.</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={setDiscussionPinned.bind(null, discussion.id, !discussion.pinned)}><button className="button-secondary px-4 py-2.5 text-sm font-bold">{discussion.pinned ? 'Unpin discussion' : 'Pin discussion'}</button></form>
          <form action={setDiscussionLocked.bind(null, discussion.id, !discussion.locked)}><button className="button-secondary px-4 py-2.5 text-sm font-bold">{discussion.locked ? 'Unlock replies' : 'Lock replies'}</button></form>
          {discussion.status === 'removed'
            ? <form action={restoreDiscussion.bind(null, discussion.id)}><button className="button-primary px-4 py-2.5 text-sm">Restore discussion</button></form>
            : <form action={removeDiscussion.bind(null, discussion.id)}><button className="button-danger px-4 py-2.5 text-sm">Remove discussion</button></form>}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        <section aria-labelledby="body-heading" className="min-w-0 border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 id="body-heading" className="text-lg font-semibold">Discussion body</h2><div className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-300">{discussion.body}</div></section>
        <aside aria-labelledby="details-heading" className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 id="details-heading" className="text-lg font-semibold">Operational details</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs uppercase tracking-wider text-zinc-500">Topic</dt><dd className="mt-1 break-words text-zinc-200">{discussion.topic?.icon ? <span aria-hidden="true">{discussion.topic.icon} </span> : null}{discussion.topic?.name ?? 'No topic'}</dd></div><div><dt className="text-xs uppercase tracking-wider text-zinc-500">Author</dt><dd className="mt-1 text-zinc-200">{circleAuthorName(discussion.author)}</dd></div><div><dt className="text-xs uppercase tracking-wider text-zinc-500">Activity</dt><dd className="mt-1 text-zinc-200">{discussion.replyCount} replies · {discussion.likeCount} likes · {discussion.view_count} views</dd></div><div><dt className="text-xs uppercase tracking-wider text-zinc-500">Created</dt><dd className="mt-1 text-zinc-200">{formatDate(discussion.created_at)}</dd></div><div><dt className="text-xs uppercase tracking-wider text-zinc-500">Updated</dt><dd className="mt-1 text-zinc-200">{formatDate(discussion.updated_at)}</dd></div></dl></aside>
      </div>

      <section aria-labelledby="replies-heading" className="mt-8">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Read-only moderation context</p><h2 id="replies-heading" className="mt-2 text-2xl font-semibold">Replies <span className="text-zinc-500">({discussion.replyCount})</span></h2></div>
        {result.repliesTruncated ? <p className="mt-4 border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-100">Showing the oldest {result.replies.length} replies of {discussion.replyCount}. The view is bounded for reliable administration.</p> : null}
        {!result.hasError && result.replies.length === 0 ? <p className="mt-5 border border-dashed border-white/15 bg-zinc-900/30 p-8 text-center text-zinc-400">No replies have been posted.</p> : null}
        {result.replies.length ? <ol className="mt-5 divide-y divide-white/10 border border-white/10">{result.replies.map((reply) => <li key={reply.id} className="bg-zinc-950/40 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-white">{circleAuthorName(reply.author)}</p><span className="border border-white/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">{reply.parent_reply_id ? 'Child reply' : 'Top-level reply'}</span><span className="border border-white/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-300">Status: {reply.status}</span></div><p className="text-xs leading-5 text-zinc-500">Created {formatDate(reply.created_at)}<br />Updated {formatDate(reply.updated_at)}</p></div><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-300">{reply.body}</p></li>)}</ol> : null}
      </section>
    </article>
  )
}
