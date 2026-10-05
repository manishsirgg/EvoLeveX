import Link from 'next/link'

import { requireAdmin } from '@/lib/admin-auth'
import { getStoreAdminOverview } from '@/lib/admin-store'

const stats = [
  ['categories', 'Categories'],
  ['products', 'Products'],
  ['draft', 'Draft'],
  ['published', 'Published'],
  ['archived', 'Archived'],
] as const

const destinations = [
  { title: 'Categories', description: 'Organize the catalog taxonomy.', phase: 'Manage categories', href: '/admin/store/categories' },
  { title: 'Products', description: 'Manage products and their publication lifecycle.', phase: 'Manage products', href: '/admin/store/products' },
]

export default async function StoreAdminPage() {
  await requireAdmin()
  const overview = await getStoreAdminOverview()

  return (
    <section aria-labelledby="store-admin-title">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Catalog management</p>
      <h1 id="store-admin-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Evo Store</h1>
      <p className="mt-3 max-w-2xl leading-7 text-zinc-400">A secure overview of the Store catalog and its publication lifecycle.</p>

      <div className="mt-9 border border-white/10 bg-zinc-900/50">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Catalog summary</p>
          <h2 className="mt-2 text-xl font-semibold">Current records</h2>
        </div>
        {overview ? (
          <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
            {stats.map(([key, label]) => (
              <div key={key} className="border-b border-r border-white/10 p-5 last:border-r-0 sm:p-6">
                <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
                <dd className="mt-2 text-3xl font-semibold tabular-nums text-white">{overview[key]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p role="status" className="p-6 text-sm text-zinc-400">Store totals are temporarily unavailable.</p>
        )}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2" aria-label="Upcoming Store management areas">
        {destinations.map((destination) => (
          <article key={destination.title} className="border border-white/10 bg-zinc-900/30 p-6">
            <h2 className="text-xl font-semibold">{destination.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{destination.description}</p>
            {destination.href
              ? <Link href={destination.href} className="mt-5 inline-flex text-xs font-semibold uppercase tracking-[0.14em] text-amber-300 hover:text-amber-200">{destination.phase} →</Link>
              : <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{destination.phase}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}
