import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/admin-auth'
import { getStoreAdminCategory, getStoreAdminCategories } from '@/lib/admin-store'
import { isStoreUuid } from '@/lib/admin-store-validation'
import { StoreCategoryForm } from '../category-form'

export default async function EditStoreCategoryPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  if (!isStoreUuid(id)) notFound()

  const [{ success }, result, all] = await Promise.all([searchParams, getStoreAdminCategory(id), getStoreAdminCategories()])
  if (!result.category && !result.hasError) notFound()

  if (!result.category) return <section><p role="alert" className="border border-rose-400/30 bg-rose-400/5 p-5 text-rose-200">This category could not be loaded right now. Refresh to try again.</p><Link href="/admin/store/categories" className="button-secondary mt-5 px-4 py-3 text-sm font-bold">Back to categories</Link></section>

  return (
    <section aria-labelledby="edit-store-category-title">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Categories</p><h1 id="edit-store-category-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Edit category</h1><p className="mt-3 text-zinc-400">Update {result.category.name}&apos;s catalog details and availability.</p></div><Link href="/admin/store/categories" className="button-secondary px-4 py-3 text-sm font-bold">Back to categories</Link></div>
      {success === 'updated' ? <p role="status" className="mt-6 border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm text-emerald-200">Category changes saved successfully.</p> : null}
      <StoreCategoryForm category={result.category} categories={all.categories} />
    </section>
  )
}
