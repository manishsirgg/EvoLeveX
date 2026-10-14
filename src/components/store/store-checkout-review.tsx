'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useStoreCart} from './store-cart-provider'
import type {SupportedCurrency} from '@/lib/currency'
import type {ResolvedStoreCartLine,StoreCartSummary} from '@/lib/store-cart-resolver'
import {assessStoreCheckoutReadiness} from '@/lib/store-checkout-readiness'

type Resolution={lines:ResolvedStoreCartLine[];summary:StoreCartSummary}

export function StoreCheckoutReview({currency}:{currency:SupportedCurrency}) {
  const {items,isHydrated}=useStoreCart()
  const [quote,setQuote]=useState<Resolution|null>(null)
  const [error,setError]=useState('')
  const [revision,setRevision]=useState(0)
  const serialized=JSON.stringify(items)
  useEffect(()=>{
    if(!isHydrated)return
    const controller=new AbortController()
    queueMicrotask(()=>{setQuote(null);setError('')})
    if(!items.length)return
    void fetch('/api/store/cart/resolve',{method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),
      signal:controller.signal}).then(async r=>{
      if(!r.ok)throw new Error('unavailable')
      return await r.json() as Resolution
    }).then(setQuote).catch(e=>{
      if(!(e instanceof DOMException&&e.name==='AbortError'))setError('Unable to revalidate your cart. No order was created.')
    })
    return ()=>controller.abort()
  // Derived from the entire item payload so changing quantities revalidates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isHydrated,serialized,currency,revision])
  const readiness=quote?assessStoreCheckoutReadiness(quote.lines,quote.summary):null
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12">
    <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Evo Store · Checkout foundation</p>
    <h1 className="text-3xl font-semibold">Review your physical order</h1>
    <p className="text-zinc-300">This is an order-readiness preview. Payment, stock reservations and order submission are deliberately disabled until the atomic order workflow is implemented and tested.</p>
    {!isHydrated?<p>Loading your cart…</p>:!items.length?<p>Your cart is empty. <Link href="/store" className="text-amber-300">Continue shopping</Link></p>:<>
      {error&&<p role="alert" className="text-rose-300">{error}</p>}
      {!quote&&!error&&<p role="status">Verifying prices and availability…</p>}
      {quote&&<section className="space-y-3 border border-white/20 p-5">
        {quote.lines.map(line=><div key={line.variantId} className="flex justify-between gap-4 border-b border-white/10 py-3">
          <div><p>{line.product?.name??'Unavailable item'}</p><p className="text-sm text-zinc-400">Quantity {line.quantity} · {[line.size,line.color].filter(Boolean).join(' / ')}</p><p className="text-xs text-zinc-400">{line.availability}</p></div>
          <span>{line.lineTotal?.formatted??'Not available'}</span>
        </div>)}
        <p className="font-semibold">Items subtotal: {quote.summary.subtotal.formatted}</p>
        <p className="text-sm text-zinc-400">Currency: {quote.summary.currency}. Shipping and tax are not included and cannot yet be calculated.</p>
        {readiness&&!readiness.readyForOrderAttempt&&<p role="alert" className="text-amber-300">Some items are not eligible for checkout. Please review your cart.</p>}
        {readiness?.readyForOrderAttempt&&<p className="text-amber-300">Cart items qualify for an order attempt, but order creation, payment and inventory reservation are not enabled.</p>}
      </section>}
      <button type="button" className="border border-amber-300 px-4 py-2 text-amber-200" onClick={()=>setRevision(v=>v+1)}>Refresh current prices</button>
    </>}
    <div className="flex flex-wrap gap-3"><Link className="button-secondary px-4 py-3" href="/store/cart">Back to cart</Link>
      <button type="button" disabled className="button-primary px-4 py-3 opacity-40">Payment unavailable — testing in progress</button></div>
  </main>
}
