'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import type { StoreAdminCategory } from '@/lib/admin-store'
import { initialStoreAdminActionState, normalizeStoreSlug, type StoreAdminActionState } from '@/lib/admin-store-validation'
import { createStoreCategoryAction, updateStoreCategoryAction } from './actions'

const inputClass = 'mt-2 w-full border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-amber-300 focus:outline-none'
const labelClass = 'block text-xs font-bold uppercase tracking-[0.13em] text-zinc-400'

export function StoreCategoryForm({ category, categories }: { category?: StoreAdminCategory; categories: StoreAdminCategory[] }) {
  const action = category ? updateStoreCategoryAction.bind(null, category.id) : createStoreCategoryAction
  const [state, formAction, pending] = useActionState<StoreAdminActionState, FormData>(action, initialStoreAdminActionState)
  const [name, setName] = useState(state.fields?.name ?? category?.name ?? '')
  const [slug, setSlug] = useState(state.fields?.slug ?? category?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(category || state.fields?.slug))
  const field = (key: string, fallback: string | number | null | undefined = '') => state.fields?.[key] ?? fallback ?? ''
  const active = state.fields ? state.fields.is_active === 'on' : category?.is_active ?? true
  const eligibleParents = categories.filter((item) => item.parent_id === null && item.id !== category?.id)

  return (
    <form action={formAction} className="mt-7 space-y-7">
      {state.error ? <p role="alert" className="border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200">{state.error}</p> : null}
      <section className="border border-white/10 bg-zinc-950/40 p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Category details</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="category-name" className={labelClass}>Name</label>
            <input id="category-name" name="name" required value={name} onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(normalizeStoreSlug(event.target.value)) }} className={inputClass} />
          </div>
          <div>
            <label htmlFor="category-slug" className={labelClass}>Slug</label>
            <input id="category-slug" name="slug" required value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value) }} className={inputClass} aria-describedby="category-slug-help" />
            <p id="category-slug-help" className="mt-2 text-xs text-zinc-600">Normalized to lowercase URL-safe words when saved.</p>
          </div>
          <div>
            <label htmlFor="category-parent" className={labelClass}>Parent category</label>
            <select id="category-parent" name="parent_id" defaultValue={field('parent_id', category?.parent_id)} className={inputClass}>
              <option value="">None — top-level category</option>
              {eligibleParents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
            </select>
            <p className="mt-2 text-xs text-zinc-500">Choose Fashion for T-Shirts and Hoodies. Only two levels are allowed.</p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="category-description" className={labelClass}>Description <span className="normal-case text-zinc-600">(optional)</span></label>
            <textarea id="category-description" name="description" rows={5} defaultValue={field('description', category?.description)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="category-sort-order" className={labelClass}>Sort order</label>
            <input id="category-sort-order" name="sort_order" type="number" min="0" step="1" required defaultValue={field('sort_order', category?.sort_order ?? 0)} className={inputClass} />
            <p className="mt-2 text-xs text-zinc-600">Lower numbers appear first.</p>
          </div>
          <div className="flex items-center pt-7">
            <label className="flex items-center gap-3 text-sm text-zinc-300">
              <input name="is_active" type="checkbox" defaultChecked={active} className="size-4 accent-amber-300" />
              Active and available for the Store catalog
            </label>
          </div>
        </div>
      </section>
      {category ? <p className="border border-amber-300/20 bg-amber-300/[0.03] p-4 text-sm leading-6 text-amber-100">A category used by a published product cannot be deactivated. Published products will never be changed automatically.</p> : null}
      <div className="flex flex-wrap gap-3">
        <button disabled={pending} className="button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">{pending ? 'Saving…' : category ? 'Save category' : 'Create category'}</button>
        <Link href="/admin/store/categories" className="button-secondary px-5 py-3 text-sm font-bold">Cancel</Link>
      </div>
    </form>
  )
}
