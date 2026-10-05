'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import type { StoreAdminCategoryOption, StoreAdminProduct } from '@/lib/admin-store'
import { initialStoreAdminActionState, normalizeStoreSlug, type StoreAdminActionState } from '@/lib/admin-store-validation'
import { archiveStoreProductAction, createStoreProductAction, publishStoreProductAction, updateStoreProductAction } from './actions'

const inputClass = 'mt-2 w-full border border-white/15 bg-black/30 px-4 py-3 text-sm text-white focus:border-amber-300 focus:outline-none disabled:opacity-60'
const labelClass = 'block text-xs font-bold uppercase tracking-[0.13em] text-zinc-400'

function LifecycleButton({ product, action, archive = false }: { product: StoreAdminProduct; action: typeof publishStoreProductAction; archive?: boolean }) {
  const [state, formAction, pending] = useActionState<StoreAdminActionState, FormData>(action.bind(null, product.id), initialStoreAdminActionState)
  return <form action={formAction} onSubmit={archive ? (event) => { if (!window.confirm('Archive this product? This cannot be restored in the V1 admin.')) event.preventDefault() } : undefined}>
    {state.error ? <p role="alert" className="mb-3 text-sm text-rose-200">{state.error}</p> : null}
    <button disabled={pending} className={archive ? 'button-secondary px-5 py-3 text-sm font-bold text-rose-200' : 'button-primary px-5 py-3 text-sm'}>{pending ? 'Working…' : archive ? 'Archive product' : 'Publish product'}</button>
  </form>
}

export function StoreProductForm({ product, categories }: { product?: StoreAdminProduct; categories: StoreAdminCategoryOption[] }) {
  const archived = product?.publication_status === 'archived'
  const action = product ? updateStoreProductAction.bind(null, product.id) : createStoreProductAction
  const [state, formAction, pending] = useActionState<StoreAdminActionState, FormData>(action, initialStoreAdminActionState)
  const [name, setName] = useState(state.fields?.name ?? product?.name ?? '')
  const [slug, setSlug] = useState(state.fields?.slug ?? product?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(product || state.fields?.slug))
  const field = (key: string, fallback: string | number | null | undefined = '') => state.fields?.[key] ?? fallback ?? ''
  const options = categories.filter((category) => category.is_active || category.id === product?.category_id || product?.publication_status === 'draft')

  return <>
    {archived ? <p className="mt-7 border border-amber-300/30 p-4 text-amber-100">Archived products are read-only and cannot be restored in the V1 admin.</p> : null}
    <form action={formAction} className="mt-7 space-y-7">
      {state.error ? <p role="alert" className="border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200">{state.error}</p> : null}
      <fieldset disabled={archived} className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7">
        <legend className="px-2 text-xl font-semibold">Product Core</legend>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div><label htmlFor="product-name" className={labelClass}>Name</label><input id="product-name" name="name" required value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(normalizeStoreSlug(e.target.value)) }} className={inputClass} /></div>
          <div><label htmlFor="product-slug" className={labelClass}>Slug</label><input id="product-slug" name="slug" required value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value) }} className={inputClass} /></div>
          <div><label htmlFor="product-category" className={labelClass}>Category</label><select id="product-category" name="category_id" defaultValue={field('category_id', product?.category_id)} className={inputClass}><option value="">Unassigned</option>{options.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (inactive)'}</option>)}</select><p className="mt-2 text-xs text-amber-100/70">Publication requires an active category.</p></div>
          <div><label htmlFor="product-sort" className={labelClass}>Sort order</label><input id="product-sort" name="sort_order" type="number" min="0" step="1" required defaultValue={field('sort_order', product?.sort_order ?? 0)} className={inputClass} /></div>
          <div className="md:col-span-2"><label htmlFor="product-short" className={labelClass}>Short description</label><textarea id="product-short" name="short_description" rows={2} defaultValue={field('short_description', product?.short_description)} className={inputClass} /></div>
          <div className="md:col-span-2"><label htmlFor="product-description" className={labelClass}>Description</label><textarea id="product-description" name="description" rows={6} defaultValue={field('description', product?.description)} className={inputClass} /></div>
          <div><label htmlFor="product-seo-title" className={labelClass}>SEO title</label><input id="product-seo-title" name="seo_title" defaultValue={field('seo_title', product?.seo_title)} className={inputClass} /></div>
          <div><label htmlFor="product-seo-description" className={labelClass}>SEO description</label><textarea id="product-seo-description" name="seo_description" rows={3} defaultValue={field('seo_description', product?.seo_description)} className={inputClass} /></div>
          <label className="flex items-center gap-3 text-sm text-zinc-300"><input name="is_featured" type="checkbox" defaultChecked={state.fields ? state.fields.is_featured === 'on' : product?.is_featured} className="size-4 accent-amber-300" /> Featured product</label>
        </div>
      </fieldset>
      {!archived ? <div className="flex gap-3"><button disabled={pending} className="button-primary px-5 py-3 text-sm">{pending ? 'Saving…' : product ? 'Save product' : 'Create draft'}</button><Link href="/admin/store/products" className="button-secondary px-5 py-3 text-sm font-bold">Cancel</Link></div> : null}
    </form>
    {product && !archived ? <section className="mt-8 flex flex-wrap gap-4 border border-white/10 p-5"><div className="w-full"><h2 className="text-xl font-semibold">Lifecycle actions</h2><p className="mt-2 text-sm text-zinc-400">Publication is committed only if database readiness enforcement succeeds.</p></div>{product.publication_status === 'draft' ? <LifecycleButton product={product} action={publishStoreProductAction} /> : null}<LifecycleButton product={product} action={archiveStoreProductAction as typeof publishStoreProductAction} archive /></section> : null}
  </>
}
