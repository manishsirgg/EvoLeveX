import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { getStoreReadinessMessage } from '@/lib/admin-store-errors'
import { getStoreAdminProduct, getStoreAdminProductCategories, inspectStoreAdminProductReadiness } from '@/lib/admin-store'
import { isStoreUuid } from '@/lib/admin-store-validation'
import { StoreProductForm } from '../product-form'

const placeholders = [['Images', 'Product image management arrives in a later phase.'], ['Variants & Prices', 'Variant and authoritative price management arrives in a later phase.'], ['Inventory', 'Inventory management arrives in a later phase.']] as const

export default async function StoreProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!isStoreUuid(id)) notFound()
  const [{ success }, productResult, categoryResult, readiness] = await Promise.all([searchParams, getStoreAdminProduct(id), getStoreAdminProductCategories(), inspectStoreAdminProductReadiness(id)])
  if (!productResult.product && !productResult.hasError) notFound()
  if (!productResult.product) return <p role="alert" className="text-rose-200">This product could not be loaded right now.</p>
  const product = productResult.product
  return <section><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Products</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{product.publication_status === 'archived' ? 'View' : 'Edit'} product</h1><p className="mt-3 text-zinc-400">{product.name} · <span className="capitalize">{product.publication_status}</span></p></div><Link href="/admin/store/products" className="button-secondary px-4 py-3 text-sm font-bold">Back to products</Link></div>
    {success ? <p role="status" className="mt-6 border border-emerald-400/30 p-4 text-emerald-200">{success === 'created' ? 'Draft created successfully.' : success === 'published' ? 'Product published successfully.' : success === 'archived' ? 'Product archived successfully.' : 'Product changes saved successfully.'}</p> : null}
    <StoreProductForm product={product} categories={categoryResult.categories} />
    <section className="mt-8 border border-white/10 p-5"><h2 className="text-xl font-semibold">Publication / Readiness</h2><p className="mt-2 text-sm text-zinc-400">Advisory snapshot only. The database transaction is the final publication authority.</p>{readiness.hasError ? <p role="alert" className="mt-4 text-rose-200">Readiness could not be inspected right now.</p> : readiness.issues.length ? <ul className="mt-4 space-y-2">{readiness.issues.map((issue, index) => <li key={`${issue.code}-${issue.variant_id ?? index}`} className="border border-amber-300/20 p-3 text-sm text-amber-100">{getStoreReadinessMessage(issue.code)}{issue.scope === 'variant' ? ' (variant)' : ''}</li>)}</ul> : <p className="mt-4 text-sm text-emerald-300">No current readiness issues were reported.</p>}</section>
    <div className="mt-8 grid gap-5 md:grid-cols-3">{placeholders.map(([title, copy]) => <section key={title} className="border border-dashed border-white/15 p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{copy}</p></section>)}</div>
  </section>
}
