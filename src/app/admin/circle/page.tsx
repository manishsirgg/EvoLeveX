import Link from 'next/link'

import { requireAdmin } from '@/lib/admin-auth'
import { getPendingReportCount } from '@/lib/admin-circle-reports'

export default async function AdminCirclePage() {
  await requireAdmin()
  const pending = await getPendingReportCount()

  return (
    <section aria-labelledby="circle-admin-title">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Circle</p>
      <h1 id="circle-admin-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Community</h1>
      <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
        Organize EvoLeveX community topics and moderate member discussions from one focused workspace.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <section className="border border-white/10 bg-zinc-900/50 p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Organization</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Discussion topics</h2>
          <p className="mt-2 max-w-xl leading-7 text-zinc-400">Create, order, and control the topics available to the community.</p>
          <Link href="/admin/circle/topics" className="button-secondary mt-5 px-5 py-3 text-sm font-bold">Manage topics</Link>
        </section>
        <section className="border border-white/10 bg-zinc-900/50 p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Moderation</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Community discussions</h2>
          <p className="mt-2 max-w-xl leading-7 text-zinc-400">Review activity, pin key conversations, lock replies, and manage visibility.</p>
          <Link href="/admin/circle/discussions" className="button-primary mt-5 px-5 py-3 text-sm">Manage discussions</Link>
        </section>
        <section className="border border-white/10 bg-zinc-900/50 p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Reports / Moderation</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Member reports{!pending.hasError ? <span className="ml-2 text-amber-300">({pending.count} pending)</span> : null}</h2>
          <p className="mt-2 max-w-xl leading-7 text-zinc-400">Review member reports, inspect target context, and take explicit moderation action.</p>
          <Link href="/admin/circle/reports" className="button-primary mt-5 px-5 py-3 text-sm">Open report queue</Link>
        </section>
      </div>
    </section>
  )
}
