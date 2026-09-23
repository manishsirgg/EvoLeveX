'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import {
  CIRCLE_TOPIC_LIMITS,
  CircleTopicActionState,
  initialCircleTopicState,
  normalizeCircleTopicSlug,
} from '@/lib/admin-circle-validation'
import { createTopicAction, updateTopicAction } from './actions'

export type CircleTopicRecord = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
}

const inputClass = 'mt-2 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none transition-colors focus:border-amber-300'
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-zinc-400'

export function TopicEditor({ topic, saved = false }: { topic: CircleTopicRecord | null; saved?: boolean }) {
  const action = topic ? updateTopicAction.bind(null, topic.id) : createTopicAction
  const [state, formAction, pending] = useActionState<CircleTopicActionState, FormData>(action, initialCircleTopicState)
  const [name, setName] = useState(state.fields?.name ?? topic?.name ?? '')
  const [slug, setSlug] = useState(state.fields?.slug ?? topic?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(topic || state.fields?.slug))
  const field = (key: string, fallback?: string | number | null) => state.fields?.[key] ?? fallback ?? ''
  const active = state.isActive ?? topic?.is_active ?? true

  return (
    <section aria-labelledby="topic-editor-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Evo Circle</p>
          <h1 id="topic-editor-title" className="mt-3 text-3xl font-semibold">{topic ? 'Edit topic' : 'New topic'}</h1>
        </div>
        <Link href="/admin/circle/topics" className="button-secondary px-4 py-3 text-sm font-bold">Back to topics</Link>
      </div>

      {saved ? <p role="status" className="mt-6 border border-emerald-400/30 bg-emerald-400/5 p-4 text-emerald-200">Topic saved successfully.</p> : null}
      {state.error ? <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-4 text-rose-200">{state.error}</p> : null}

      <form action={formAction} className="mt-7 border border-white/10 bg-zinc-950/40 p-5 sm:p-7">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="name">Name</label>
            <input className={inputClass} id="name" name="name" required maxLength={CIRCLE_TOPIC_LIMITS.name} value={name} onChange={(event) => { const value = event.target.value; setName(value); if (!slugTouched) setSlug(normalizeCircleTopicSlug(value)) }} />
          </div>
          <div>
            <label className={labelClass} htmlFor="slug">Slug</label>
            <input className={inputClass} id="slug" name="slug" required maxLength={CIRCLE_TOPIC_LIMITS.slug} value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value) }} aria-describedby="slug-help" />
            <p id="slug-help" className="mt-2 text-xs text-zinc-500">Lowercase URL path, normalized when saved.</p>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="description">Description <span className="normal-case tracking-normal text-zinc-600">(optional)</span></label>
            <textarea className={inputClass} id="description" name="description" rows={5} maxLength={CIRCLE_TOPIC_LIMITS.description} defaultValue={field('description', topic?.description)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="icon">Icon <span className="normal-case tracking-normal text-zinc-600">(optional)</span></label>
            <input className={inputClass} id="icon" name="icon" maxLength={CIRCLE_TOPIC_LIMITS.icon} defaultValue={field('icon', topic?.icon)} aria-describedby="icon-help" />
            <p id="icon-help" className="mt-2 text-xs text-zinc-500">Enter a short text, emoji, or icon value.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="sort_order">Sort order</label>
            <input className={inputClass} id="sort_order" name="sort_order" type="number" step="1" required defaultValue={field('sort_order', topic?.sort_order ?? 0)} />
          </div>
        </div>
        <label className="mt-6 flex w-fit items-center gap-3 text-sm font-semibold text-zinc-200">
          <input type="checkbox" name="is_active" defaultChecked={active} className="size-4 accent-amber-300" />
          Active
        </label>
        <button type="submit" disabled={pending} className="button-primary mt-7 px-5 py-3 text-sm">{pending ? 'Saving…' : topic ? 'Save changes' : 'Save topic'}</button>
      </form>
    </section>
  )
}
