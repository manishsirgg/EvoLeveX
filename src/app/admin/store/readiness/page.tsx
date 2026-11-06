import Link from 'next/link'
import {requireAdmin} from '@/lib/admin-auth'
import {getStoreCatalogReadiness} from '@/lib/store-catalog-readiness'

export default async function StoreCatalogReadinessPage(){
 await requireAdmin()
 const {products,error}=await getStoreCatalogReadiness()
 return <section aria-labelledby="catalog-readiness-title">
  <div className="flex flex-wrap items-end justify-between gap-4">
   <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Evo Store · Launch preparation</p>
    <h1 id="catalog-readiness-title" className="mt-3 text-3xl font-semibold">Catalog readiness</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Complete missing variant information using verified supplier prices, weights and inventory. This is a setup checklist, not approval to publish or take payments.</p></div>
   <Link href="/admin/store" className="button-secondary px-4 py-3 text-sm">Back to Store</Link>
  </div>
  {error?<p role="alert" className="mt-8 border border-rose-400/30 p-5 text-sm text-rose-200">Catalog readiness could not be loaded. Refresh to try again.</p>
  :products.length===0?<p className="mt-8 border border-white/10 p-6 text-zinc-300">No products yet. <Link href="/admin/store/products/new" className="text-amber-300">Create a draft product</Link>.</p>
  :<div className="mt-8 space-y-4">{products.map(product=>{
   const unresolved=product.missingWeight+product.missingActivePrice+product.missingInventory
   return <article key={product.id} className="border border-white/10 bg-zinc-900/30 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><h2 className="text-lg font-semibold text-white">{product.name}</h2>
      <p className="mt-1 text-xs capitalize text-zinc-400">{product.publication_status} · {product.variantCount} variants · {product.activeCount} active</p>
     </div>
     <Link href={`/admin/store/products/${product.id}#store-product-variants`} className="text-sm font-semibold text-amber-300 hover:text-amber-200">Prepare variants</Link>
    </div>
    <dl className="mt-5 grid gap-3 sm:grid-cols-3">
     {([['Missing weights',product.missingWeight],['Missing active prices',product.missingActivePrice],['Missing inventory records',product.missingInventory]] as const).map(([label,value])=>
      <div key={label} className="border border-white/10 p-4"><dt className="text-xs text-zinc-400">{label}</dt><dd className={`mt-2 text-2xl font-semibold tabular-nums ${value>0?'text-amber-200':'text-emerald-300'}`}>{value}</dd></div>)}
    </dl>
    {product.variantCount===0?<p className="mt-4 text-xs text-amber-200">Add product variants before attempting publication.</p>
    :unresolved===0?<p className="mt-4 text-xs text-emerald-300">Local variant fields are configured. Supplier fulfilment, availability and publication checks still apply.</p>
    :<p className="mt-4 text-xs text-amber-200">Configure the missing fields. Prices must reflect verified landed costs; inventory must not be invented for print-on-demand products.</p>}
   </article>
  })}</div>}
  <p className="mt-6 text-xs text-zinc-500">This page is read-only. It does not activate variants, publish products, set stock, create orders or enable Razorpay / Printful dispatch.</p>
 </section>
}
