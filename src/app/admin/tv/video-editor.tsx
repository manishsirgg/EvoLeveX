'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { TvOption, TvVideo, videoState } from '@/lib/admin-tv-shared'
import { initialTvState, slugifyTv, TvActionState } from '@/lib/admin-tv-validation'
import { createVideoAction, updateVideoAction } from './actions'

const input = 'mt-2 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-amber-300'
const label = 'block text-xs font-bold uppercase tracking-wider text-zinc-400'
function localDate(value?: string | null) { if (!value) return ''; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16) }

export function VideoEditor({ video, categories, series, optionsError, feedback }: { video: TvVideo | null; categories: TvOption[]; series: TvOption[]; optionsError: boolean; feedback?: string }) {
  const action = video ? updateVideoAction.bind(null, video.id) : createVideoAction
  const [state, formAction, pending] = useActionState<TvActionState, FormData>(action, initialTvState)
  const [title, setTitle] = useState(state.fields?.title ?? video?.title ?? '')
  const [slug, setSlug] = useState(state.fields?.slug ?? video?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(video || state.fields?.slug))
  const field = (name: string, fallback?: string | number | null) => state.fields?.[name] ?? fallback ?? ''
  const status = video ? videoState(video) : 'new'
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Evo TV</p><h1 className="mt-3 text-3xl font-semibold">{video ? 'Edit video' : 'New video'}</h1><p className="mt-3 text-zinc-400">{video ? `Current state: ${status}` : 'Add a YouTube video to the Evo TV library.'}</p></div><div className="flex gap-3"><Link href="/admin/tv" className="button-secondary px-4 py-3 text-sm font-bold">Back to videos</Link>{video && <Link href={`/admin/tv/${video.id}/preview`} className="button-primary px-4 py-3 text-sm">Preview</Link>}</div></div>
    {feedback && <p role="status" className="mt-6 border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm text-emerald-200">Video saved successfully.</p>}
    {state.error && <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200">{state.error}</p>}
    {optionsError && <p role="alert" className="mt-6 text-sm text-rose-200">Category or series options could not be loaded. Refresh before saving.</p>}
    <form action={formAction} className="mt-7 space-y-7">
      <section className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 className="text-xl font-semibold">Video details</h2><div className="mt-6 grid gap-6 md:grid-cols-2">
        <div><label htmlFor="youtube_video_id" className={label}>YouTube video ID or URL</label><input id="youtube_video_id" name="youtube_video_id" required defaultValue={field('youtube_video_id', video?.youtube_video_id)} className={input} placeholder="dQw4w9WgXcQ or a YouTube URL" /></div>
        <div><label htmlFor="title" className={label}>Title</label><input id="title" name="title" required value={title} onChange={e => { setTitle(e.target.value); if (!slugTouched) setSlug(slugifyTv(e.target.value)) }} className={input} /></div>
        <div><label htmlFor="slug" className={label}>Slug</label><input id="slug" name="slug" required value={slug} onChange={e => { setSlugTouched(true); setSlug(e.target.value) }} className={input} /></div>
        <div><label htmlFor="thumbnail_url" className={label}>Thumbnail URL override</label><input id="thumbnail_url" name="thumbnail_url" type="url" defaultValue={field('thumbnail_url', video?.thumbnail_url)} className={input} placeholder="YouTube thumbnail used when blank" /></div>
        <div className="md:col-span-2"><label htmlFor="description" className={label}>Description</label><textarea id="description" name="description" rows={6} defaultValue={field('description', video?.description)} className={input} /></div>
        <div><label htmlFor="category_id" className={label}>Category</label><select id="category_id" name="category_id" defaultValue={field('category_id', video?.category_id)} className={input}><option value="">Uncategorized</option>{categories.map(x => <option key={x.id} value={x.id}>{x.label}{!x.active ? ' (inactive)' : ''}</option>)}</select></div>
        <div><label htmlFor="series_id" className={label}>Series</label><select id="series_id" name="series_id" defaultValue={field('series_id', video?.series_id)} className={input}><option value="">No series</option>{series.map(x => <option key={x.id} value={x.id}>{x.label}{!x.active ? ' (inactive)' : ''}</option>)}</select></div>
        <div><label htmlFor="duration_seconds" className={label}>Duration (seconds)</label><input id="duration_seconds" name="duration_seconds" type="number" min="0" step="1" defaultValue={field('duration_seconds', video?.duration_seconds)} className={input} /></div>
        <div><label htmlFor="sort_order" className={label}>Sort order</label><input id="sort_order" name="sort_order" type="number" step="1" defaultValue={field('sort_order', video?.sort_order ?? 0)} className={input} /></div>
      </div></section>
      <section className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 className="text-xl font-semibold">Publication</h2><div className="mt-6 grid gap-6 md:grid-cols-2"><div><label htmlFor="published_at" className={label}>Publication date/time</label><input id="published_at" name="published_at" type="datetime-local" defaultValue={field('published_at', localDate(video?.published_at))} className={input} /></div><div className="flex flex-wrap items-center gap-6 pt-7"><label className="flex gap-3 text-sm"><input name="active" type="checkbox" defaultChecked={video?.active ?? true} className="accent-amber-300" />Active / publicly eligible</label><label className="flex gap-3 text-sm"><input name="featured" type="checkbox" defaultChecked={video?.featured ?? false} className="accent-amber-300" />Featured</label></div></div><div className="mt-6 flex flex-wrap gap-3"><button name="intent" value="save" disabled={pending || optionsError} className="button-secondary px-4 py-3 text-sm font-bold">Save changes</button><button name="intent" value="public" disabled={pending || optionsError} className="button-primary px-4 py-3 text-sm">Make public immediately</button><button name="intent" value="schedule" disabled={pending || optionsError} className="button-secondary px-4 py-3 text-sm font-bold">Schedule</button>{video && <button name="intent" value="hide" disabled={pending} className="button-danger px-4 py-3 text-sm font-bold">Hide</button>}</div></section>
      <section className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 className="text-xl font-semibold">Search and sharing</h2><div className="mt-6 grid gap-6 md:grid-cols-2"><div><label htmlFor="seo_title" className={label}>SEO title</label><input id="seo_title" name="seo_title" defaultValue={field('seo_title', video?.seo_title)} className={input} /></div><div><label htmlFor="seo_description" className={label}>SEO description</label><textarea id="seo_description" name="seo_description" rows={4} defaultValue={field('seo_description', video?.seo_description)} className={input} /></div></div></section>
    </form>
  </section>
}
