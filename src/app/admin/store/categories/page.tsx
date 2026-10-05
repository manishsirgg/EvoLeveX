import Link from 'next/link'

import { requireAdmin } from '@/lib/admin-auth'
import { getStoreAdminCategories } from '@/lib/admin-store'
import { StoreCategoryForm } from './category-form'

export default async function StoreCategoriesPage({ searchParams }: {
  searchParams: Promise<{ success?: string }>
}) {
  await requireAdmin()
  const [{ success }, result] = await Promise.all([searchParams, getStoreAdminCategories()])

  return (
    <section aria-labelledby="store-categories-title">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Catalog</p>
          <h1 id="store-categories-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Categories</h1>
          <p className="mt-3 max-w-2xl leading-7 text-zinc-400">Create, order, and activate the categories used to organize Store products.</p>
        </div>
        <Link href="/admin/store" className="button-secondary px-4 py-3 text-sm font-bold">Back to Evo Store</Link>
      </div>

      {success === 'created' ? <p role="status" className="mt-6 border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm text-emerald-200">Category created successfully.</p> : null}

      <section aria-labelledby="existing-categories-title" className="mt-8">
        <div className="flex items-center justify-between gap-4"><h2 id="existing-categories-title" className="text-xl font-semibold">Existing categories</h2><span className="text-sm tabular-nums text-zinc-500">{result.hasError ? 'Unavailable' : `${result.categories.length} total`}</span></div>
        {result.hasError ? (
          <p role="alert" className="mt-4 border border-rose-400/30 bg-rose-400/5 p-5 text-sm text-rose-200">Categories could not be loaded right now. Refresh to try again.</p>
        ) : result.categories.length === 0 ? (
          <p className="mt-4 border border-dashed border-white/15 bg-zinc-900/30 p-8 text-center text-zinc-400">No Store categories yet. Create the first category below.</p>
        ) : (
          <div className="mt-4 overflow-x-auto border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-500"><tr><th className="px-5 py-4">Category</th><th className="px-5 py-4">Slug</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Sort order</th><th className="px-5 py-4 text-right">Products</th><th className="px-5 py-4 text-right"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-white/10">
                {result.categories.map((category) => <tr key={category.id} className="bg-zinc-950/30">
                  <td className="px-5 py-4 font-semibold text-white">{category.name}</td><td className="px-5 py-4 text-zinc-400">/{category.slug}</td>
                  <td className="px-5 py-4"><span className={`border px-2.5 py-1 text-xs font-bold uppercase ${category.is_active ? 'border-emerald-400/30 text-emerald-300' : 'border-zinc-600 text-zinc-400'}`}>{category.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-5 py-4 text-right tabular-nums text-zinc-300">{category.sort_order}</td><td className="px-5 py-4 text-right tabular-nums text-zinc-300">{category.product_count}</td>
                  <td className="px-5 py-4 text-right"><Link href={`/admin/store/categories/${category.id}`} className="font-semibold text-amber-300 hover:text-amber-200">Edit</Link></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="create-category-title" className="mt-10 border-t border-white/10 pt-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">New category</p>
        <h2 id="create-category-title" className="mt-2 text-2xl font-semibold">Create a category</h2>
        <StoreCategoryForm />
      </section>
    </section>
  )
}
