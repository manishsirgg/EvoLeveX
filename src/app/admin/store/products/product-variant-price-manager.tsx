'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/currency'
import type { StoreAdminVariantPrice } from '@/lib/admin-store'
import { createStoreVariantPriceAction, setStoreVariantPriceActiveStateAction, updateStoreVariantPriceAction, type StoreVariantPriceActionState } from './actions'

const inputClass = 'mt-1 w-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white'

function PriceRow({ productId, variantId, price, readOnly }: { productId: string; variantId: string; price: StoreAdminVariantPrice; readOnly: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(price.amount)
  const [message, setMessage] = useState<StoreVariantPriceActionState>({})
  const [pending, startTransition] = useTransition()
  const run = (task: () => Promise<StoreVariantPriceActionState>) => startTransition(async () => {
    setMessage({})
    const result = await task()
    setMessage(result)
    if (result.success) { setEditing(false); router.refresh() }
  })
  return <li className="border border-white/10 bg-black/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><span className="font-mono font-bold text-white">{price.currency} {price.amount}</span><span className={price.is_active ? 'ml-3 text-xs font-bold text-emerald-300' : 'ml-3 text-xs font-bold text-zinc-400'}>{price.is_active ? 'Active' : 'Inactive'}</span></div>
      {!readOnly ? <div className="flex gap-2"><button type="button" disabled={pending} onClick={() => { setAmount(price.amount); setEditing(!editing) }} className="button-secondary px-3 py-1.5 text-xs font-bold">{editing ? 'Cancel' : 'Edit amount'}</button><button type="button" disabled={pending} onClick={() => run(() => setStoreVariantPriceActiveStateAction(productId, variantId, price.id, !price.is_active))} className="button-secondary px-3 py-1.5 text-xs font-bold">{price.is_active ? 'Deactivate' : 'Activate'}</button></div> : null}
    </div>
    {editing && !readOnly ? <form className="mt-3 flex items-end gap-2 border-t border-white/10 pt-3" onSubmit={(event) => { event.preventDefault(); run(() => updateStoreVariantPriceAction(productId, variantId, price.id, amount)) }}><label className="flex-1 text-xs font-bold uppercase text-zinc-400">{price.currency} amount<input name="amount" required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} /></label><button disabled={pending} className="button-primary px-3 py-2 text-sm">Save</button></form> : null}
    {message.error ? <p role="alert" className="mt-2 text-sm text-rose-200">{message.error}</p> : null}{message.success ? <p role="status" className="mt-2 text-sm text-emerald-300">{message.success}</p> : null}
  </li>
}

export function ProductVariantPriceManager({ productId, variantId, prices, archived }: { productId: string; variantId: string; prices: StoreAdminVariantPrice[]; archived: boolean }) {
  const router = useRouter()
  const represented = new Set(prices.map(({ currency }) => currency))
  const available = SUPPORTED_CURRENCIES.filter(({ code }) => !represented.has(code))
  const [adding, setAdding] = useState(false)
  const [currency, setCurrency] = useState<SupportedCurrency>(available[0]?.code ?? 'USD')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState<StoreVariantPriceActionState>({})
  const [pending, startTransition] = useTransition()
  return <section className="mt-5 border-t border-white/10 pt-4">
    <div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold">Prices</h4><p className="text-xs text-zinc-500">Merchant-defined authoritative prices.</p></div>{!archived && available.length ? <button type="button" onClick={() => setAdding(!adding)} className="button-secondary px-3 py-2 text-xs font-bold">{adding ? 'Cancel' : 'Add price'}</button> : null}</div>
    {archived ? <p className="mt-3 text-xs text-amber-200">Archived product prices are read-only.</p> : null}
    {adding && !archived && available.length ? <form className="mt-3 grid gap-3 border border-white/10 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { setMessage({}); const result = await createStoreVariantPriceAction(productId, variantId, currency, amount); setMessage(result); if (result.success) { setAdding(false); setAmount(''); router.refresh() } }) }}><label className="text-xs font-bold uppercase text-zinc-400">Currency<select value={currency} onChange={(event) => setCurrency(event.target.value as SupportedCurrency)} className={inputClass}>{available.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label><label className="text-xs font-bold uppercase text-zinc-400">Amount<input name="amount" required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,2})?" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} /></label><button disabled={pending} className="button-primary px-3 py-2 text-sm">Add active price</button></form> : null}
    {message.error ? <p role="alert" className="mt-2 text-sm text-rose-200">{message.error}</p> : null}{message.success ? <p role="status" className="mt-2 text-sm text-emerald-300">{message.success}</p> : null}
    {prices.length ? <ul className="mt-3 space-y-2">{prices.map((price) => <PriceRow key={price.id} productId={productId} variantId={variantId} price={price} readOnly={archived} />)}</ul> : <p className="mt-3 text-sm text-zinc-500">No prices configured.</p>}
    {!archived && !available.length ? <p className="mt-3 text-xs text-zinc-500">All supported currencies have a persistent row. Reactivate an inactive price instead of recreating it.</p> : null}
  </section>
}
