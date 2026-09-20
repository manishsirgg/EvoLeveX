'use client'

import Link from 'next/link'
import { ChangeEvent, FormEvent, useActionState, useEffect, useMemo, useRef, useState } from 'react'

import { ArticleStatus, EditorArticle, EditorCategory, EditorTag } from '@/lib/admin-daily-editor'
import { EditorActionState, initialEditorState, slugify } from '@/lib/admin-daily-validation'
import { DAILY_IMAGE_ACCEPT, DAILY_IMAGE_MAX_BYTES } from '@/lib/daily-featured-image'
import { archiveArticleAction, createArticleAction, updateArticleAction } from './actions'

type Props = {
  article: EditorArticle | null
  categories: EditorCategory[]
  tags: EditorTag[]
  feedback?: string
  warning?: string
  optionsError?: boolean
}

const inputClass = 'mt-2 w-full border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-300 focus:outline-none'
const labelClass = 'block text-xs font-bold uppercase tracking-[0.13em] text-zinc-400'

function displayStatus(status: ArticleStatus, publishedAt: string | null) {
  if (status === 'published' && publishedAt && Date.parse(publishedAt) > Date.now()) return 'Scheduled'
  return status[0].toUpperCase() + status.slice(1)
}

function feedbackMessage(value?: string) {
  return ({
    'draft-saved': 'Draft saved successfully.', updated: 'Article changes saved successfully.',
    published: 'Article published successfully.', scheduled: 'Article scheduled successfully.', archived: 'Article archived successfully.',
  } as Record<string, string>)[value ?? '']
}

function localDateTimeValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function localDateTimeToIso(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString()
}

function ImagePreview({ url, title }: { url: string; title: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!url.trim() || failedUrl === url) return (
    <div className="mt-3 grid aspect-[16/9] place-items-center border border-dashed border-white/15 bg-black/20 text-xs uppercase tracking-widest text-zinc-600">
      {failedUrl === url ? 'Image could not be loaded' : 'Image preview'}
    </div>
  )
  return (
    // Native images allow specific editorial URLs without a broad Next.js remote-image allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={title ? `Preview for ${title}` : 'Featured image preview'} onError={() => setFailedUrl(url)} className="mt-3 aspect-[16/9] w-full border border-white/10 object-cover" />
  )
}

function FeaturedImageManager({ initialUrl, title }: { initialUrl: string; title: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [intent, setIntent] = useState<'keep' | 'upload' | 'remove' | 'url'>('keep')
  const [url, setUrl] = useState(initialUrl)
  const [preview, setPreview] = useState(initialUrl)
  const [error, setError] = useState('')
  const [showUrl, setShowUrl] = useState(false)

  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview) }, [preview])

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      event.target.value = ''
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > DAILY_IMAGE_MAX_BYTES) {
      event.target.value = ''
      setError('Featured images must be 5 MB or smaller.')
      return
    }
    setIntent('upload')
    setShowUrl(false)
    setPreview(URL.createObjectURL(file))
  }

  function removeImage() {
    if (inputRef.current) inputRef.current.value = ''
    setIntent('remove')
    setUrl('')
    setPreview('')
    setError('')
  }

  return <div className="mt-5">
    <p className={labelClass}>Featured image</p>
    <input type="hidden" name="image_intent" value={intent} />
    <input type="hidden" name="featured_image_url" value={url} />
    <input ref={inputRef} id="featured_image" name="featured_image" type="file" accept={DAILY_IMAGE_ACCEPT} onChange={selectFile} className="sr-only" />
    {preview ? <ImagePreview url={preview} title={title} /> : (
      <div className="mt-3 grid aspect-[16/9] place-items-center border border-dashed border-white/15 bg-black/20 px-4 text-center text-xs uppercase tracking-widest text-zinc-600">No featured image</div>
    )}
    <p className="mt-3 text-xs leading-5 text-zinc-500">Recommended: 16:9 · JPG, PNG or WebP · Max 5 MB</p>
    {error ? <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p> : null}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" onClick={() => inputRef.current?.click()} className="border border-white/20 px-4 py-2.5 text-sm font-bold hover:border-amber-300">{preview ? 'Replace image' : 'Upload image'}</button>
      {preview ? <button type="button" onClick={removeImage} className="px-3 py-2.5 text-sm font-semibold text-zinc-400 hover:text-rose-300">Remove image</button> : null}
    </div>
    <button type="button" onClick={() => setShowUrl((value) => !value)} className="mt-4 text-xs font-semibold text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300">{showUrl ? 'Hide external URL' : 'Use image URL instead'}</button>
    {showUrl ? <div className="mt-3"><label htmlFor="featured-image-external" className={labelClass}>External image URL</label><input id="featured-image-external" type="url" value={url} onChange={(event) => { setUrl(event.target.value); setPreview(event.target.value); setIntent('url'); if (inputRef.current) inputRef.current.value = '' }} className={inputClass} placeholder="https://…" /><p className="mt-2 text-xs text-zinc-600">Only HTTP or HTTPS URLs are accepted.</p></div> : null}
  </div>
}

export function ArticleEditor({ article, categories, tags, feedback, warning, optionsError = false }: Props) {
  const action = article ? updateArticleAction.bind(null, article.id) : createArticleAction
  const [state, formAction, pending] = useActionState<EditorActionState, FormData>(action, initialEditorState)
  const [archiveState, archiveAction, archivePending] = useActionState<EditorActionState, FormData>(
    article ? archiveArticleAction.bind(null, article.id) : async () => initialEditorState, initialEditorState,
  )
  const [title, setTitle] = useState(article?.title ?? '')
  const [slug, setSlug] = useState(article?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(article))
  const [scheduleLocal, setScheduleLocal] = useState(() => (
    article?.published_at && Date.parse(article.published_at) > Date.now() ? localDateTimeValue(article.published_at) : ''
  ))
  const [scheduleIso, setScheduleIso] = useState(article?.published_at ?? '')
  const [archiveConfirmed, setArchiveConfirmed] = useState(false)
  const status = article ? displayStatus(article.status, article.published_at) : 'New article'
  const success = feedbackMessage(feedback)
  const selectedTags = useMemo(() => new Set(article?.tagIds ?? []), [article?.tagIds])

  function handleTitle(value: string) {
    setTitle(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function prepareSchedule(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (submitter?.value !== 'schedule') return
    setScheduleIso(localDateTimeToIso(scheduleLocal))
  }

  const field = (name: string, fallback: string | null | undefined) => state.fields?.[name] ?? fallback ?? ''

  return (
    <section aria-labelledby="editor-title">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-7">
        <div>
          <Link href="/admin/daily" className="text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-white">← All articles</Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Daily editor</p>
          <h1 id="editor-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{article ? 'Edit article' : 'Create an article'}</h1>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-300">Status: {status}</div>
          {article ? (
            <Link href={`/admin/daily/${article.id}/preview`} className="primary-action inline-flex items-center justify-center px-5 py-3 text-sm shadow-lg shadow-amber-950/20">
              Preview Article <span className="ml-2" aria-hidden="true">→</span>
            </Link>
          ) : <p className="max-w-52 text-left text-xs leading-5 text-zinc-500 sm:text-right">Save the article first to preview it.</p>}
        </div>
      </div>

      {success ? <p role="status" className="mt-6 border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm text-emerald-200">{success}</p> : null}
      {warning ? <p role="alert" className="mt-6 border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-100">{warning}</p> : null}
      {state.error ? <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200">{state.error}</p> : null}

      <form action={formAction} onSubmit={prepareSchedule} className="mt-7">
        <input type="hidden" name="schedule_at" value={scheduleIso} />
        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6 border border-white/10 bg-zinc-950/40 p-5 sm:p-7">
            <div>
              <label htmlFor="title" className={labelClass}>Title <span className="text-amber-300">*</span></label>
              <input id="title" name="title" required maxLength={240} value={title} onChange={(e) => handleTitle(e.target.value)} className={`${inputClass} text-lg font-semibold`} placeholder="A clear, compelling article title" />
            </div>
            <div>
              <label htmlFor="slug" className={labelClass}>Slug <span className="text-amber-300">*</span></label>
              <div className="mt-2 flex border border-white/15 bg-black/30 focus-within:border-amber-300"><span className="border-r border-white/10 px-3 py-3 text-sm text-zinc-600">/daily/</span><input id="slug" name="slug" required maxLength={120} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white focus:outline-none" /></div>
              <p className="mt-2 text-xs leading-5 text-zinc-600">Generated from the title until you edit it. Existing slugs are always preserved.</p>
            </div>
            <div><label htmlFor="excerpt" className={labelClass}>Excerpt</label><textarea id="excerpt" name="excerpt" rows={4} maxLength={1000} defaultValue={field('excerpt', article?.excerpt)} className={inputClass} placeholder="A concise introduction for article cards and previews." /></div>
            <div><label htmlFor="content" className={labelClass}>Article body <span className="text-amber-300">*</span></label><textarea id="content" name="content" required rows={24} defaultValue={field('content', article?.content)} className={`${inputClass} resize-y leading-7`} placeholder="Write in plain text. Paragraph breaks and newlines are preserved." /><p className="mt-2 text-xs leading-5 text-zinc-600">Plain text only. Use blank lines to separate paragraphs.</p></div>
          </div>

          <aside className="space-y-5">
            <div className="border border-white/10 bg-zinc-950/40 p-5">
              <h2 className="font-semibold">Publishing</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Saving changes preserves the current state. Scheduling uses your browser&apos;s local time and stores the exact UTC instant.</p>
              <label htmlFor="schedule-local" className={`${labelClass} mt-5`}>Publication date &amp; time</label>
              <input id="schedule-local" type="datetime-local" value={scheduleLocal} onChange={(e) => { setScheduleLocal(e.target.value); setScheduleIso(localDateTimeToIso(e.target.value)) }} className={inputClass} />
              <div className="mt-5 grid gap-2">
                <button name="intent" value="save" disabled={pending || optionsError} className="border border-white/20 px-4 py-3 text-sm font-bold hover:border-white/50 disabled:opacity-50">{article ? 'Save Changes' : 'Save Draft'}</button>
                {article && article.status !== 'draft' ? <button name="intent" value="draft" disabled={pending || optionsError} className="border border-white/20 px-4 py-3 text-sm font-bold text-zinc-300 hover:border-white/50 disabled:opacity-50">{article.status === 'archived' ? 'Restore as Draft' : 'Move to Draft'}</button> : null}
                <button name="intent" value="publish" disabled={pending || optionsError} className="primary-action px-4 py-3 text-sm">Publish Now</button>
                <button name="intent" value="schedule" disabled={pending || optionsError} className="border border-sky-400/30 px-4 py-3 text-sm font-bold text-sky-200 hover:border-sky-300 disabled:opacity-50">{status === 'Scheduled' ? 'Reschedule' : 'Schedule'}</button>
              </div>
              {pending ? <p role="status" className="mt-3 text-xs text-zinc-400">Saving article…</p> : null}
            </div>

            <div className="border border-white/10 bg-zinc-950/40 p-5">
              <h2 className="font-semibold">Organization</h2>
              <label htmlFor="category_id" className={`${labelClass} mt-5`}>Category</label>
              <select id="category_id" name="category_id" defaultValue={field('category_id', article?.category_id)} className={inputClass}>
                <option value="">Uncategorized</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.is_active ? '' : ' (inactive — current)'}</option>)}
              </select>
              <fieldset className="mt-6"><legend className={labelClass}>Existing tags</legend><div className="mt-3 max-h-48 space-y-2 overflow-y-auto border border-white/10 p-3">
                {tags.length ? tags.map((tag) => <label key={tag.id} className="flex items-center gap-3 text-sm text-zinc-300"><input type="checkbox" name="tag_ids" value={tag.id} defaultChecked={selectedTags.has(tag.id)} className="accent-amber-300" />{tag.name}</label>) : <p className="text-xs text-zinc-600">No tags exist yet.</p>}
              </div></fieldset>
              <label htmlFor="new_tags" className={`${labelClass} mt-5`}>Add new tags</label><input id="new_tags" name="new_tags" defaultValue={field('new_tags', '')} className={inputClass} placeholder="Mindset, Discipline, Personal Growth" /><p className="mt-2 text-xs leading-5 text-zinc-600">Separate new tags with commas. Do not include #. Existing matches are reused.</p>
            </div>

            <div className="border border-white/10 bg-zinc-950/40 p-5">
              <h2 className="font-semibold">Presentation</h2>
              <FeaturedImageManager initialUrl={article?.featured_image_url ?? ''} title={title} />
              <label className="mt-5 flex items-start gap-3 text-sm text-zinc-300"><input type="checkbox" name="is_featured" defaultChecked={article?.is_featured} className="mt-1 accent-amber-300" /><span><strong className="block text-white">Featured article</strong>Prioritize this article in Evo Daily presentation.</span></label>
              <label htmlFor="read_time_minutes" className={`${labelClass} mt-6`}>Read time (minutes)</label><input id="read_time_minutes" name="read_time_minutes" type="number" min="1" max="2147483647" step="1" defaultValue={field('read_time_minutes', article?.read_time_minutes?.toString())} className={inputClass} placeholder="Optional" />
            </div>
          </aside>
        </div>

        <section className="mt-7 border border-white/10 bg-zinc-950/40 p-5 sm:p-7" aria-labelledby="seo-title">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Metadata</p><h2 id="seo-title" className="mt-2 text-2xl font-semibold">Search and sharing</h2><p className="mt-2 text-sm text-zinc-500">Optional inline SEO fields for this article.</p></div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div><label htmlFor="seo_title" className={labelClass}>SEO title</label><input id="seo_title" name="seo_title" maxLength={300} defaultValue={field('seo_title', article?.seo_title)} className={inputClass} /></div>
            <div><label htmlFor="canonical_url" className={labelClass}>Canonical URL</label><input id="canonical_url" name="canonical_url" type="url" defaultValue={field('canonical_url', article?.canonical_url)} className={inputClass} placeholder="https://…" /></div>
            <div><label htmlFor="seo_description" className={labelClass}>SEO description</label><textarea id="seo_description" name="seo_description" rows={4} defaultValue={field('seo_description', article?.seo_description)} className={inputClass} /></div>
            <div><label htmlFor="seo_keywords" className={labelClass}>SEO keywords</label><textarea id="seo_keywords" name="seo_keywords" rows={4} defaultValue={field('seo_keywords', article?.seo_keywords?.join(', '))} className={inputClass} placeholder="growth, discipline, wellbeing" /><p className="mt-2 text-xs text-zinc-600">Comma-separated; blanks and duplicates are removed.</p></div>
          </div>
        </section>
      </form>

      {!article ? <section className="mt-7 border border-dashed border-white/15 p-6 text-sm text-zinc-400"><strong className="block text-white">Magazine Blocks</strong><span className="mt-2 block">Save the article first to add magazine blocks.</span></section> : null}

      {article && article.status !== 'archived' ? (
        <section className="mt-7 border border-rose-400/20 bg-rose-400/5 p-5 sm:p-7" aria-labelledby="archive-title">
          <h2 id="archive-title" className="font-semibold text-rose-100">Archive article</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Archiving removes the article from public Evo Daily without permanently deleting it.</p>
          {archiveState.error ? <p role="alert" className="mt-3 text-sm text-rose-200">{archiveState.error}</p> : null}
          <form action={archiveAction} className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-3 text-sm text-zinc-300"><input type="checkbox" checked={archiveConfirmed} onChange={(e) => setArchiveConfirmed(e.target.checked)} className="accent-rose-400" />I confirm that I want to archive this article.</label>
            <button disabled={!archiveConfirmed || archivePending} className="border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-200 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-40">{archivePending ? 'Archiving…' : 'Archive Article'}</button>
          </form>
        </section>
      ) : null}
    </section>
  )
}
