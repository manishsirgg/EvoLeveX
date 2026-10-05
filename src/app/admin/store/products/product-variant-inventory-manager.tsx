'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StoreAdminVariantInventory } from '@/lib/admin-store'
import { addStoreVariantInventoryAction, initializeStoreVariantInventoryAction, removeStoreVariantInventoryAction, setStoreVariantInventoryAction, type StoreVariantInventoryActionState } from './actions'

const inputClass = 'mt-1 w-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white'
const quantityProps = { required: true, inputMode: 'numeric' as const, pattern: '[0-9]+', maxLength: 10 }

export function ProductVariantInventoryManager({ productId, variantId, inventory, archived }: { productId: string; variantId: string; inventory: StoreAdminVariantInventory | null; archived: boolean }) {
  const router = useRouter()
  const [message, setMessage] = useState<StoreVariantInventoryActionState>({})
  const [pending, startTransition] = useTransition()
  const run = (task: () => Promise<StoreVariantInventoryActionState>, form: HTMLFormElement) => startTransition(async () => {
    setMessage({})
    const result = await task()
    setMessage(result)
    if (result.success) { form.reset(); router.refresh() }
  })
  const available = inventory ? inventory.quantity_on_hand - inventory.quantity_reserved : null

  return <section className="mt-5 border-t border-white/10 pt-4">
    <div><h4 className="font-semibold">Inventory</h4><p className={inventory ? 'text-xs text-emerald-300' : 'text-xs text-amber-200'}>{inventory ? 'Inventory configured' : 'Inventory not configured'}</p></div>
    {inventory ? <>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-zinc-500">On hand</dt><dd className="font-bold">{inventory.quantity_on_hand}</dd></div><div><dt className="text-zinc-500">Reserved</dt><dd className="font-bold">{inventory.quantity_reserved}</dd></div><div><dt className="text-zinc-500">Available</dt><dd className="font-bold">{available}</dd></div></dl>
      {inventory.quantity_reserved > 0 ? <p className="mt-2 text-xs text-amber-200">On-hand stock cannot be set or reduced below reserved stock.</p> : null}
      {archived ? <p className="mt-3 text-xs text-amber-200">Archived product inventory is read-only.</p> : <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <form className="border border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; run(() => addStoreVariantInventoryAction(productId, variantId, String(new FormData(form).get('quantity'))), form) }}><h5 className="text-sm font-semibold">Add stock</h5><label className="mt-2 block text-xs font-bold uppercase text-zinc-400">Quantity<input name="quantity" {...quantityProps} className={inputClass} /></label><button disabled={pending} className="button-secondary mt-3 px-3 py-2 text-xs font-bold">Add stock</button></form>
        <form className="border border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); run(() => removeStoreVariantInventoryAction(productId, variantId, String(data.get('quantity')), String(data.get('reason'))), form) }}><h5 className="text-sm font-semibold">Remove stock</h5><label className="mt-2 block text-xs font-bold uppercase text-zinc-400">Quantity<input name="quantity" {...quantityProps} className={inputClass} /></label><label className="mt-2 block text-xs font-bold uppercase text-zinc-400">Reason<select name="reason" className={inputClass}><option value="damage">Damaged</option><option value="loss">Lost</option><option value="manual_correction">Manual correction</option></select></label><button disabled={pending} className="button-secondary mt-3 px-3 py-2 text-xs font-bold">Remove stock</button></form>
        <form className="border border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; run(() => setStoreVariantInventoryAction(productId, variantId, String(new FormData(form).get('quantity'))), form) }}><h5 className="text-sm font-semibold">Set stock</h5><p className="mt-1 text-xs text-zinc-500">Sets the absolute on-hand count after a stocktake.</p><label className="mt-2 block text-xs font-bold uppercase text-zinc-400">New on-hand quantity<input name="quantity" {...quantityProps} className={inputClass} /></label><button disabled={pending} className="button-secondary mt-3 px-3 py-2 text-xs font-bold">Set stock</button></form>
      </div>}
    </> : archived ? <p className="mt-3 text-xs text-amber-200">Archived product inventory is read-only and cannot be initialized.</p> : <form className="mt-3 max-w-sm border border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; run(() => initializeStoreVariantInventoryAction(productId, variantId, String(new FormData(form).get('quantity'))), form) }}><label className="text-xs font-bold uppercase text-zinc-400">Initial stock<input name="quantity" {...quantityProps} className={inputClass} /></label><button disabled={pending} className="button-secondary mt-3 px-3 py-2 text-xs font-bold">Initialize inventory</button></form>}
    {message.error ? <p role="alert" className="mt-3 text-sm text-rose-200">{message.error}</p> : null}{message.success ? <p role="status" className="mt-3 text-sm text-emerald-300">{message.success}</p> : null}
  </section>
}
