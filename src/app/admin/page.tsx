import Link from 'next/link'

import { requireAdmin } from '@/lib/admin-auth'
import { getAdminDailyStats } from '@/lib/admin-daily'

const statLabels = { total: 'Total', draft: 'Drafts', published: 'Published', scheduled: 'Scheduled', archived: 'Archived' }

export default async function AdminDashboard() {
  await requireAdmin()
  const { stats } = await getAdminDailyStats()

  return (
    <section aria-labelledby="admin-dashboard-title">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Operations</p>
      <h1 id="admin-dashboard-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
      <p className="mt-3 max-w-2xl leading-7 text-zinc-400">Manage EvoLeveX publishing from one secure workspace.</p>

      <div className="mt-9 border border-white/10 bg-zinc-900/50">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Publishing</p><h2 className="mt-2 text-xl font-semibold">Evo Daily</h2></div>
          <Link href="/admin/daily" className="button-primary px-4 py-2.5 text-sm">Manage articles</Link>
        </div>
        {stats ? (
          <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
            {(Object.keys(statLabels) as (keyof typeof statLabels)[]).map((key) => (
              <div key={key} className="border-b border-r border-white/10 p-5 last:border-r-0 sm:p-6">
                <dt className="text-xs uppercase tracking-wider text-zinc-500">{statLabels[key]}</dt>
                <dd className="mt-2 text-3xl font-semibold tabular-nums text-white">{stats[key]}</dd>
              </div>
            ))}
          </dl>
        ) : <p role="status" className="p-6 text-sm text-zinc-400">Publishing totals are temporarily unavailable.</p>}
      </div>
    </section>
  )
}
