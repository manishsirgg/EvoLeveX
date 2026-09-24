import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { getVaultStats } from '@/lib/admin-vault'

const labels = { total: 'Total products', active: 'Active', books: 'Books', courses: 'Courses', featured: 'Featured' }
export default async function AdminVaultPage() {
  await requireAdmin(); const stats = await getVaultStats()
  return <section><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Catalog</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Evo Vault</h1><p className="mt-3 max-w-2xl text-zinc-400">Manage the books and courses that form the Vault catalog.</p></div><div className="flex gap-3"><Link href="/admin/vault/products" className="button-secondary px-5 py-3 text-sm font-bold">Manage products</Link><Link href="/admin/vault/products/new" className="button-primary px-5 py-3 text-sm">Add product</Link></div></div>
    <div className="mt-9 border border-white/10 bg-zinc-900/50"><div className="border-b border-white/10 p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-300">Current catalog</p><h2 className="mt-2 text-xl font-semibold">Vault summary</h2></div>{stats ? <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">{(Object.keys(labels) as (keyof typeof labels)[]).map(key => <div key={key} className="border-b border-r border-white/10 p-5 sm:p-6"><dt className="text-xs uppercase tracking-wider text-zinc-500">{labels[key]}</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{stats[key]}</dd></div>)}</dl> : <p role="alert" className="p-6 text-sm text-rose-200">Vault totals are temporarily unavailable.</p>}</div>
  </section>
}
