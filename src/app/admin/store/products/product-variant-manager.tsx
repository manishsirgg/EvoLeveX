'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StoreAdminProductVariant } from '@/lib/admin-store'
import { createStoreProductVariantAction, setStoreProductVariantActiveState, updateStoreProductVariantAction, type StoreVariantActionState } from './actions'
import { ProductVariantPriceManager } from './product-variant-price-manager'
import { ProductVariantInventoryManager } from './product-variant-inventory-manager'

const inputClass = 'mt-1 w-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white'

function VariantFields({ variant }: { variant?: StoreAdminProductVariant }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <label className="text-xs font-bold uppercase text-zinc-400">SKU<input name="sku" required maxLength={64} defaultValue={variant?.sku} className={inputClass} /></label>
    <label className="text-xs font-bold uppercase text-zinc-400">Size code<input name="size_code" maxLength={32} defaultValue={variant?.size_code ?? ''} className={inputClass} /></label>
    <label className="text-xs font-bold uppercase text-zinc-400">Color code<input name="color_code" maxLength={32} defaultValue={variant?.color_code ?? ''} className={inputClass} /></label>
    <label className="text-xs font-bold uppercase text-zinc-400">Weight (g)<input name="weight_g" type="number" min="1" max="2147483647" step="1" defaultValue={variant?.weight_g ?? ''} className={inputClass} /></label>
    <label className="text-xs font-bold uppercase text-zinc-400">Sort order<input name="sort_order" required type="number" min="0" max="2147483647" step="1" defaultValue={variant?.sort_order ?? 0} className={inputClass} /></label>
  </div>
}

function VariantCard({ variant, readOnly }: { variant: StoreAdminProductVariant; readOnly: boolean }) {
  const router = useRouter(); const [editing, setEditing] = useState(false); const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<StoreVariantActionState>({})
  const run = (task: () => Promise<StoreVariantActionState>) => startTransition(async () => { setMessage({}); const result = await task(); setMessage(result); if (result.success) { setEditing(false); router.refresh() } })
  const priceReady = variant.active_positive_price_count > 0
  return <article className="border border-white/10 bg-black/20 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-mono text-lg font-bold text-white">{variant.sku}</h3><p className="text-xs text-zinc-500">Sort order {variant.sort_order}</p></div><span className={variant.is_active ? 'bg-emerald-400/15 px-2 py-1 text-xs font-bold text-emerald-200' : 'bg-zinc-700 px-2 py-1 text-xs font-bold text-zinc-300'}>{variant.is_active ? 'Active' : 'Inactive'}</span></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-zinc-500">Size</dt><dd>{variant.size_code ?? '—'}</dd></div><div><dt className="text-zinc-500">Color</dt><dd>{variant.color_code ?? '—'}</dd></div><div><dt className="text-zinc-500">Weight (g)</dt><dd>{variant.weight_g ?? 'Not configured'}</dd></div><div><dt className="text-zinc-500">Dependencies</dt><dd className={priceReady ? 'text-emerald-300' : 'text-amber-200'}>{priceReady ? 'Pricing configured' : 'Pricing not configured'}</dd><dd className={variant.inventory_configured ? 'text-emerald-300' : 'text-amber-200'}>{variant.inventory_configured ? 'Inventory configured' : 'Inventory not configured'}</dd></div></dl>
    {!readOnly ? <><div className="mt-4 flex gap-2"><button type="button" disabled={pending} onClick={() => setEditing(!editing)} className="button-secondary px-3 py-2 text-sm font-bold">{editing ? 'Cancel' : 'Edit'}</button><button type="button" disabled={pending} onClick={() => run(() => setStoreProductVariantActiveState(variant.product_id, variant.id, !variant.is_active))} className="button-secondary px-3 py-2 text-sm font-bold">{variant.is_active ? 'Deactivate' : 'Activate'}</button></div>
      {editing ? <form className="mt-4 border-t border-white/10 pt-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => updateStoreProductVariantAction(variant.product_id, variant.id, { sku: String(data.get('sku')), size_code: String(data.get('size_code')) || null, color_code: String(data.get('color_code')) || null, weight_g: data.get('weight_g') === '' ? null : Number(data.get('weight_g')), sort_order: Number(data.get('sort_order')) })) }}><VariantFields variant={variant} /><button disabled={pending} className="button-primary mt-4 px-4 py-2 text-sm">Save variant</button></form> : null}</> : null}
    {message.error ? <p role="alert" className="mt-3 text-sm text-rose-200">{message.error}</p> : null}{message.success ? <p role="status" className="mt-3 text-sm text-emerald-300">{message.success}</p> : null}
    <ProductVariantPriceManager productId={variant.product_id} variantId={variant.id} prices={variant.prices} archived={readOnly} />
    <ProductVariantInventoryManager productId={variant.product_id} variantId={variant.id} inventory={variant.inventory} archived={readOnly} />
  </article>
}

export function ProductVariantManager({ productId, variants, archived, hasError }: { productId: string; variants: StoreAdminProductVariant[]; archived: boolean; hasError: boolean }) {
  const router = useRouter(); const [adding, setAdding] = useState(false); const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<StoreVariantActionState>({})
  const active = variants.filter((variant) => variant.is_active).length
  return <section className="mt-8 border border-white/10 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Variants</h2><p className="mt-2 text-sm text-zinc-400">{variants.length} total · {active} active. New variants are always inactive.</p></div>{!archived ? <button type="button" onClick={() => setAdding(!adding)} className="button-primary px-4 py-2 text-sm">{adding ? 'Cancel' : 'Add variant'}</button> : null}</div>
    <p className="mt-2 text-xs text-zinc-500">Size and color are optional. Manage authoritative pricing and inventory inside each variant.</p>
    {archived ? <p className="mt-4 border border-amber-300/30 p-3 text-sm text-amber-100">Archived product variants are read-only.</p> : null}
    {adding && !archived ? <form className="mt-5 border border-white/10 bg-black/20 p-4" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; startTransition(async () => { setMessage({}); const result = await createStoreProductVariantAction(productId, new FormData(form)); setMessage(result); if (result.success) { form.reset(); setAdding(false); router.refresh() } }) }}><VariantFields /><button disabled={pending} className="button-primary mt-4 px-4 py-2 text-sm">Create inactive variant</button></form> : null}
    {hasError ? <p role="alert" className="mt-4 text-sm text-rose-200">Variants or dependency indicators could not be loaded. Refresh to try again.</p> : null}{message.error ? <p role="alert" className="mt-3 text-sm text-rose-200">{message.error}</p> : null}{message.success ? <p role="status" className="mt-3 text-sm text-emerald-300">{message.success}</p> : null}
    {variants.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{variants.map((variant) => <VariantCard key={variant.id} variant={variant} readOnly={archived} />)}</div> : <p className="mt-5 text-sm text-zinc-500">No variants have been added.</p>}
  </section>
}
