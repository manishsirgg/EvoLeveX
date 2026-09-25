'use client'

import Link from 'next/link'
import { ChangeEvent, useActionState, useEffect, useRef, useState } from 'react'
import type { Instructor, VaultBook, VaultCategory, VaultCourse, VaultProduct } from '@/lib/admin-vault'
import { initialVaultState, slugifyVault, type VaultActionState, type VaultKind } from '@/lib/admin-vault-validation'
import { DEFAULT_CURRENCY, parseSupportedCurrency, SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/currency'
import { VAULT_COVER_ACCEPT, VAULT_COVER_MAX_BYTES } from '@/lib/vault-cover-image'
import { createVaultProductAction, updateVaultProductAction } from './actions'

const input = 'mt-2 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-amber-300'
const label = 'block text-xs font-bold uppercase tracking-wider text-zinc-400'

function CoverImageManager({ initialUrl, title }: { initialUrl: string; title: string }) {
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
    if (file.size > VAULT_COVER_MAX_BYTES) {
      event.target.value = ''
      setError('Cover images must be 5 MB or smaller.')
      return
    }
    setIntent('upload')
    setShowUrl(false)
    setPreview(URL.createObjectURL(file))
  }

  function removeCover() {
    if (inputRef.current) inputRef.current.value = ''
    setIntent('remove')
    setUrl('')
    setPreview('')
    setError('')
  }

  return <div className="md:col-span-2">
    <p className={label}>Cover image</p>
    <input type="hidden" name="cover_intent" value={intent} />
    <input type="hidden" name="cover_image_url" value={url} />
    <input ref={inputRef} id="cover_image" name="cover_image" type="file" accept={VAULT_COVER_ACCEPT} onChange={selectFile} className="sr-only" />
    {preview ? (
      // Native images support both selected blob previews and arbitrary validated external URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={preview} alt={title ? `Cover preview for ${title}` : 'Cover image preview'} className="mt-3 aspect-[3/4] w-full max-w-56 border border-white/10 bg-black/20 object-cover" />
    ) : <div className="mt-3 grid aspect-[3/4] w-full max-w-56 place-items-center border border-dashed border-white/15 bg-black/20 px-4 text-center text-xs uppercase tracking-widest text-zinc-600">No cover image</div>}
    <p className="mt-3 text-xs leading-5 text-zinc-500">Upload a JPG, PNG, or WebP image (maximum 5 MB), or provide an external URL. A newly selected upload takes precedence.</p>
    {error ? <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p> : null}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" onClick={() => inputRef.current?.click()} className="button-secondary px-4 py-2.5 text-sm font-bold">{preview ? 'Replace cover' : 'Upload cover'}</button>
      {preview ? <button type="button" onClick={removeCover} className="px-3 py-2.5 text-sm font-semibold text-zinc-400 hover:text-rose-300">Remove cover</button> : null}
    </div>
    <button type="button" onClick={() => setShowUrl(value => !value)} className="mt-4 text-xs font-semibold text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300">{showUrl ? 'Hide external URL' : 'Use external URL instead'}</button>
    {showUrl ? <div className="mt-3"><label htmlFor="cover-image-external" className={label}>External cover image URL</label><input id="cover-image-external" type="url" value={url} onChange={event => { setUrl(event.target.value); setPreview(event.target.value); setIntent(event.target.value ? 'url' : 'keep'); if (inputRef.current) inputRef.current.value = '' }} className={input} placeholder="https://…" /><p className="mt-2 text-xs text-zinc-600">Only absolute HTTP or HTTPS URLs are accepted. Leaving this blank retains the saved cover unless you choose Remove cover.</p></div> : null}
  </div>
}

export function ProductEditor({ product, book, course, categories, categoriesError, instructors, instructorsError, feedback, warning }: { product: VaultProduct | null; book: VaultBook | null; course: VaultCourse | null; categories: VaultCategory[]; categoriesError: boolean; instructors: Instructor[]; instructorsError: boolean; feedback?: string; warning?: string }) {
  const action = product ? updateVaultProductAction.bind(null, product.id) : createVaultProductAction
  const [state, formAction, pending] = useActionState<VaultActionState, FormData>(action, initialVaultState)
  const [name, setName] = useState(state.fields?.name ?? product?.name ?? '')
  const [slug, setSlug] = useState(state.fields?.slug ?? product?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(product || state.fields?.slug))
  const [kind, setKind] = useState<VaultKind>((state.fields?.kind || product?.kind || 'book') as VaultKind)
  const [currency, setCurrency] = useState<SupportedCurrency>(parseSupportedCurrency(state.fields?.currency) ?? product?.currency ?? DEFAULT_CURRENCY)
  const field = (key: string, fallback?: string | number | null) => state.fields?.[key] ?? fallback ?? ''
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Evo Vault</p><h1 className="mt-3 text-3xl font-semibold">{product ? 'Edit product' : 'Add product'}</h1><p className="mt-3 text-zinc-400">{product ? 'Update this product and its matching subtype details.' : 'Create a book or course in the Vault.'}</p></div><Link href="/admin/vault/products" className="button-secondary px-4 py-3 text-sm font-bold">Back to products</Link></div>
    {feedback && <p role="status" className="mt-6 border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm text-emerald-200">Product saved successfully.</p>}
    {warning && <p role="status" className="mt-6 border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-200">{warning}</p>}
    {state.error && <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200">{state.error}</p>}
    {instructorsError && <p role="alert" className="mt-6 border border-rose-400/30 p-4 text-sm text-rose-200">Instructor options could not be fully loaded. Refresh before saving a course.</p>}
    {categoriesError && <p role="alert" className="mt-6 border border-rose-400/30 p-4 text-sm text-rose-200">Category options could not be fully loaded. Refresh before saving.</p>}
    <form action={formAction} className="mt-7 space-y-7">
      <section className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 className="text-xl font-semibold">Product details</h2><div className="mt-6 grid gap-6 md:grid-cols-2">
        <div><label htmlFor="kind" className={label}>Kind</label><select id="kind" name="kind" value={kind} disabled={Boolean(product)} onChange={e => setKind(e.target.value as VaultKind)} className={input}><option value="book">Book</option><option value="course">Course</option></select>{product && <><input type="hidden" name="kind" value={kind} /><p className="mt-2 text-xs text-zinc-500">Kind is permanent after creation.</p></>}</div>
        <div><label htmlFor="category_id" className={label}>Category</label><select id="category_id" name="category_id" required defaultValue={field('category_id', product?.category_id)} className={input}><option value="" disabled>Select a category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}{category.is_active ? '' : ' (Inactive)'}</option>)}</select>{product && categories.find(category => category.id === product.category_id && !category.is_active) && <p className="mt-2 text-xs font-semibold text-amber-300">This product’s current category is inactive. It can be retained or replaced with an active category.</p>}</div>
        <div><label htmlFor="product_mode" className={label}>Product mode</label><select id="product_mode" name="product_mode" defaultValue={field('product_mode', product?.product_mode ?? 'digital')} className={input}><option value="digital">Digital</option><option value="physical">Physical</option><option value="hybrid">Hybrid</option></select></div>
        <div><label htmlFor="name" className={label}>Name</label><input id="name" name="name" required value={name} onChange={e => { setName(e.target.value); if (!slugTouched) setSlug(slugifyVault(e.target.value)) }} className={input} /></div>
        <div><label htmlFor="slug" className={label}>Slug</label><input id="slug" name="slug" required value={slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={e => { setSlugTouched(true); setSlug(e.target.value) }} className={input} /></div>
        <div><label htmlFor="price" className={label}>Price</label><input id="price" name="price" required type="number" min="0" step={currency === 'JPY' ? '1' : '0.01'} defaultValue={field('price', product?.price ?? 0)} className={input} /></div>
        <div><label htmlFor="currency" className={label}>Currency</label><select id="currency" name="currency" required value={currency} onChange={event => setCurrency(event.target.value as SupportedCurrency)} className={input}>{SUPPORTED_CURRENCIES.map(option => <option key={option.code} value={option.code}>{option.code} — {option.name}</option>)}</select><p className="mt-2 text-xs text-zinc-500">Changing currency does not convert the entered price.</p></div>
        <div><label htmlFor="sort_order" className={label}>Sort order</label><input id="sort_order" name="sort_order" required type="number" step="1" defaultValue={field('sort_order', product?.sort_order ?? 0)} className={input} /></div>
        <CoverImageManager initialUrl={String(field('cover_image_url', product?.cover_image_url))} title={name} />
        <div className="md:col-span-2"><label htmlFor="short_description" className={label}>Short description</label><textarea id="short_description" name="short_description" rows={3} defaultValue={field('short_description', product?.short_description)} className={input} /></div>
        <div className="md:col-span-2"><label htmlFor="description" className={label}>Description</label><textarea id="description" name="description" rows={7} defaultValue={field('description', product?.description)} className={input} /></div>
      </div></section>
      {kind === 'book' ? <section className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 className="text-xl font-semibold">Book details</h2><p className="mt-2 text-sm text-zinc-500">Private digital file delivery is not configured in this step.</p><div className="mt-6 grid gap-6 md:grid-cols-2">
        <div><label htmlFor="author_name" className={label}>Author name</label><input id="author_name" name="author_name" defaultValue={field('author_name', book?.author_name)} className={input} /></div><div><label htmlFor="isbn" className={label}>ISBN</label><input id="isbn" name="isbn" defaultValue={field('isbn', book?.isbn)} className={input} /></div>
        <div><label htmlFor="page_count" className={label}>Page count</label><input id="page_count" name="page_count" type="number" min="1" step="1" defaultValue={field('page_count', book?.page_count)} className={input} /></div><div><label htmlFor="physical_weight_g" className={label}>Physical weight (g)</label><input id="physical_weight_g" name="physical_weight_g" type="number" min="1" step="1" defaultValue={field('physical_weight_g', book?.physical_weight_g)} className={input} /></div>
        <div className="md:col-span-2"><label htmlFor="preview_text" className={label}>Preview text</label><textarea id="preview_text" name="preview_text" rows={6} defaultValue={field('preview_text', book?.preview_text)} className={input} /></div>
      </div></section> : <section className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 className="text-xl font-semibold">Course details</h2><div className="mt-6 grid gap-6 md:grid-cols-2">
        <div><label htmlFor="instructor_id" className={label}>Instructor</label><select id="instructor_id" name="instructor_id" defaultValue={field('instructor_id', course?.instructor_id)} className={input}><option value="">No instructor</option>{instructors.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div><div><label htmlFor="level" className={label}>Level</label><input id="level" name="level" defaultValue={field('level', course?.level)} className={input} /></div>
        <div><label htmlFor="subtitle" className={label}>Subtitle</label><input id="subtitle" name="subtitle" defaultValue={field('subtitle', course?.subtitle)} className={input} /></div><div><label htmlFor="duration_minutes" className={label}>Duration (minutes)</label><input id="duration_minutes" name="duration_minutes" type="number" min="1" step="1" defaultValue={field('duration_minutes', course?.duration_minutes)} className={input} /></div>
        <div className="md:col-span-2"><label htmlFor="preview_video_url" className={label}>Preview video URL</label><input id="preview_video_url" name="preview_video_url" type="url" defaultValue={field('preview_video_url', course?.preview_video_url)} className={input} /></div>
        <label className="flex gap-3 text-sm"><input name="certificate_available" type="checkbox" defaultChecked={course?.certificate_available ?? false} className="accent-amber-300" />Certificate available</label>
      </div></section>}
      <section className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><h2 className="text-xl font-semibold">Publication and search</h2><div className="mt-6 grid gap-6 md:grid-cols-2"><div><label htmlFor="seo_title" className={label}>SEO title</label><input id="seo_title" name="seo_title" defaultValue={field('seo_title', product?.seo_title)} className={input} /></div><div><label htmlFor="seo_description" className={label}>SEO description</label><textarea id="seo_description" name="seo_description" rows={4} defaultValue={field('seo_description', product?.seo_description)} className={input} /></div><div className="flex flex-wrap gap-6 md:col-span-2"><label className="flex gap-3 text-sm"><input name="is_active" type="checkbox" defaultChecked={product?.is_active ?? true} className="accent-amber-300" />Active</label><label className="flex gap-3 text-sm"><input name="is_featured" type="checkbox" defaultChecked={product?.is_featured ?? false} className="accent-amber-300" />Featured</label></div></div><button disabled={pending || categoriesError || (kind === 'course' && instructorsError)} className="button-primary mt-7 px-5 py-3 text-sm">{pending ? 'Saving…' : 'Save product'}</button></section>
    </form>
  </section>
}
