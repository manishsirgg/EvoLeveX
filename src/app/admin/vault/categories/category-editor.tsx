'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import type { VaultCategory } from '@/lib/admin-vault'
import { initialVaultCategoryState, slugifyVault, type VaultCategoryActionState } from '@/lib/admin-vault-validation'
import { createVaultCategoryAction, updateVaultCategoryAction } from './actions'

const input = 'mt-2 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-amber-300'
const label = 'block text-xs font-bold uppercase tracking-wider text-zinc-400'

export function CategoryEditor({ category, saved = false }: { category: VaultCategory | null; saved?: boolean }) {
  const action = category ? updateVaultCategoryAction.bind(null, category.id) : createVaultCategoryAction
  const [state, formAction, pending] = useActionState<VaultCategoryActionState, FormData>(action, initialVaultCategoryState)
  const [name, setName] = useState(state.fields?.name ?? category?.name ?? '')
  const [slug, setSlug] = useState(state.fields?.slug ?? category?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(category || state.fields?.slug))
  const field = (key: string, fallback?: string | number | null) => state.fields?.[key] ?? fallback ?? ''
  return <section><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Evo Vault</p><h1 className="mt-3 text-3xl font-semibold">{category ? 'Edit category' : 'Add category'}</h1><p className="mt-3 text-zinc-400">Manage a subject shared by Vault books and courses.</p></div><Link href="/admin/vault/categories" className="button-secondary px-4 py-3 text-sm font-bold">Back to categories</Link></div>
    {saved && <p role="status" className="mt-6 border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm text-emerald-200">Category saved successfully.</p>}
    {state.error && <p role="alert" className="mt-6 border border-rose-400/30 bg-rose-400/5 p-4 text-sm text-rose-200">{state.error}</p>}
    <form action={formAction} className="mt-7 border border-white/10 bg-zinc-950/40 p-5 sm:p-7"><div className="grid gap-6 md:grid-cols-2">
      <div><label htmlFor="name" className={label}>Name</label><input id="name" name="name" required value={name} onChange={event => { setName(event.target.value); if (!slugTouched) setSlug(slugifyVault(event.target.value)) }} className={input} /></div>
      <div><label htmlFor="slug" className={label}>Slug</label><input id="slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={event => { setSlugTouched(true); setSlug(event.target.value) }} className={input} /></div>
      <div className="md:col-span-2"><label htmlFor="description" className={label}>Description</label><textarea id="description" name="description" rows={5} defaultValue={field('description', category?.description)} className={input} /></div>
      <div><label htmlFor="image_url" className={label}>Image URL</label><input id="image_url" name="image_url" type="url" placeholder="https://…" defaultValue={field('image_url', category?.image_url)} className={input} /></div>
      <div><label htmlFor="sort_order" className={label}>Sort order</label><input id="sort_order" name="sort_order" type="number" step="1" required defaultValue={field('sort_order', category?.sort_order ?? 0)} className={input} /></div>
    </div><label className="mt-6 flex w-fit items-center gap-3 text-sm"><input name="is_active" type="checkbox" defaultChecked={state.isActive ?? category?.is_active ?? true} className="accent-amber-300" />Active</label><p className="mt-2 text-xs text-zinc-500">Deactivate categories instead of deleting them. Existing products retain their assignment.</p><button disabled={pending} className="button-primary mt-7 px-5 py-3 text-sm">{pending ? 'Saving…' : 'Save category'}</button></form>
  </section>
}
