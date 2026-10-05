import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { getStoreAdminProductCategories } from '@/lib/admin-store'
import { StoreProductForm } from '../product-form'

export default async function NewStoreProductPage() {
  await requireAdmin()
  const result = await getStoreAdminProductCategories()
  return <section><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Products</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">New product</h1><p className="mt-3 text-zinc-400">Create a physical draft. Commerce dependencies can be added in later phases.</p></div><Link href="/admin/store/products" className="button-secondary px-4 py-3 text-sm font-bold">Back to products</Link></div>{result.hasError ? <p role="alert" className="mt-6 text-rose-200">Categories could not be loaded. You may still create an unassigned draft.</p> : null}<StoreProductForm categories={result.categories} /></section>
}
