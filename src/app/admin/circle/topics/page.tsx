import Link from 'next/link'

import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import type { CircleTopicRecord } from './topic-editor'

export default async function CircleTopicsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('evo_circle_topics')
    .select('id,name,slug,description,icon,sort_order,is_active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .order('id', { ascending: true })
  const topics = (data ?? []) as CircleTopicRecord[]

  return (
    <section aria-labelledby="circle-topics-title">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Circle</p>
          <h1 id="circle-topics-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Topics</h1>
          <p className="mt-3 text-zinc-400">Organize the subjects available for community discussions.</p>
        </div>
        <Link href="/admin/circle/topics/new" className="button-primary px-5 py-3 text-sm">New topic</Link>
      </div>

      {error ? <p role="alert" className="mt-7 border border-rose-400/30 bg-rose-400/5 p-5 text-rose-200">Topics could not be loaded right now. Please try again later.</p> : null}
      {!error && topics.length === 0 ? (
        <div className="mt-7 grid min-h-64 place-items-center border border-dashed border-white/15 bg-zinc-900/30 px-6 py-14 text-center">
          <div>
            <h2 className="text-2xl font-semibold">No Circle topics yet.</h2>
            <p className="mx-auto mt-3 max-w-lg leading-7 text-zinc-400">Create the first topic to start organizing community discussions.</p>
            <Link href="/admin/circle/topics/new" className="button-primary mt-6 px-5 py-3 text-sm">New topic</Link>
          </div>
        </div>
      ) : null}

      {topics.length > 0 ? (
        <ul className="mt-7 divide-y divide-white/10 border border-white/10">
          {topics.map((topic) => (
            <li key={topic.id} className="grid gap-4 bg-zinc-950/40 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  {topic.icon ? <span aria-label={`Icon: ${topic.icon}`} className="grid min-h-8 min-w-8 place-items-center border border-white/10 bg-white/[0.03] px-2 text-sm">{topic.icon}</span> : null}
                  <h2 className="font-semibold text-white">{topic.name}</h2>
                  <span className={`border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${topic.is_active ? 'border-emerald-400/30 text-emerald-300' : 'border-white/15 text-zinc-500'}`}>{topic.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">/{topic.slug}</p>
                {topic.description ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-400">{topic.description}</p> : null}
              </div>
              <div className="flex items-center justify-between gap-6 sm:justify-end">
                <p className="text-xs text-zinc-500">Order <span className="font-semibold tabular-nums text-zinc-300">{topic.sort_order}</span></p>
                <Link href={`/admin/circle/topics/${topic.id}/edit`} className="text-sm font-bold text-amber-300 hover:text-amber-200">Edit</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
