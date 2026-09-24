import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { getVaultCategories } from '@/lib/admin-vault'

export default async function VaultCategoriesPage() {
  await requireAdmin()
  const result = await getVaultCategories(null, true)
  return <section><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Evo Vault</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Categories</h1><p className="mt-3 text-zinc-400">The shared subject taxonomy for books and courses.</p></div><div className="flex gap-3"><Link href="/admin/vault" className="button-secondary px-5 py-3 text-sm font-bold">Overview</Link><Link href="/admin/vault/categories/new" className="button-primary px-5 py-3 text-sm">Add category</Link></div></div>
    {result.hasError && <p role="alert" className="mt-7 border border-rose-400/30 p-5 text-rose-200">Categories could not be loaded.</p>}
    {!result.hasError && !result.categories.length && <div className="mt-7 grid min-h-64 place-items-center border border-dashed border-white/15 text-center"><div><h2 className="text-2xl font-semibold">No Vault categories yet.</h2><Link href="/admin/vault/categories/new" className="button-primary mt-5 px-5 py-3 text-sm">Add category</Link></div></div>}
    {!!result.categories.length && <ul className="mt-7 divide-y divide-white/10 border border-white/10">{result.categories.map(category => <li key={category.id} className="grid gap-4 bg-zinc-950/40 p-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">{category.name}</h2><span className={`border px-2 py-1 text-[.65rem] font-bold uppercase ${category.is_active ? 'border-emerald-400/30 text-emerald-300' : 'border-white/20 text-zinc-400'}`}>{category.is_active ? 'Active' : 'Inactive'}</span></div><p className="mt-2 text-xs text-zinc-500">/{category.slug}</p></div><p className="text-xs text-zinc-500">Order <span className="font-semibold tabular-nums text-zinc-300">{category.sort_order}</span></p><Link href={`/admin/vault/categories/${category.id}/edit`} className="text-sm font-bold text-amber-300">Edit</Link></li>)}</ul>}
  </section>
}
