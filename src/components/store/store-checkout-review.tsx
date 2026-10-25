'use client'

import Link from 'next/link'
import {useEffect,useRef,useState} from 'react'
import {useStoreCart} from './store-cart-provider'
import type {SupportedCurrency} from '@/lib/currency'
import type {ResolvedStoreCartLine,StoreCartSummary} from '@/lib/store-cart-resolver'
import {assessStoreCheckoutReadiness} from '@/lib/store-checkout-readiness'

type Resolution={lines:ResolvedStoreCartLine[];summary:StoreCartSummary}
type NonpayableQuote={checkout_id:string;country:string;currency:string;subtotal_tax_inclusive:number|string;included_product_tax:number|string;shipping_before_any_applicable_shipping_tax:number|string;shipping_tax_status:string;quote_payable:false}

export function StoreCheckoutReview({currency,reservationEnabled,finalizationEnabled,paymentPreflightEnabled,intentClaimEnabled,addresses,addressLoadFailed}:{currency:SupportedCurrency;reservationEnabled:boolean;finalizationEnabled:boolean;paymentPreflightEnabled:boolean;intentClaimEnabled:boolean;addresses:{id:string;is_default:boolean}[];addressLoadFailed:boolean}) {
  const {items,isHydrated}=useStoreCart()
  const [addressId,setAddressId]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [reservationResult,setReservationResult]=useState<'idle'|'created'|'failed'>('idle')
  const [quotePreview,setQuotePreview]=useState<NonpayableQuote|null>(null)
  const [quoteError,setQuoteError]=useState(false)
  const [checkoutId,setCheckoutId]=useState<string|null>(null)
  const [finalizing,setFinalizing]=useState(false)
  const [finalOrder,setFinalOrder]=useState<{order_id:string;currency:string;amount:string}|null>(null)
  const [finalError,setFinalError]=useState(false)
  const [preflightStatus,setPreflightStatus]=useState<'idle'|'checking'|'reviewed'|'unavailable'>('idle')
  const [claimStatus,setClaimStatus]=useState<'idle'|'claiming'|'reserved'|'unavailable'>('idle')
  const claimAttempt=useRef<{orderId:string;key:string}|null>(null)
  // Retain the same idempotency key across ambiguous network failures while this checkout is mounted.
  const reservationAttempt=useRef<{fingerprint:string;key:string}|null>(null)
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
  const selectedAddress=addressId || addresses.find(a=>a.is_default)?.id || addresses[0]?.id || ''
  async function reserveOrder(){
    if(!reservationEnabled||!readiness?.readyForOrderAttempt||!selectedAddress||submitting||reservationResult==='created')return
    const fingerprint=JSON.stringify({items,address_id:selectedAddress,currency})
    if(reservationAttempt.current?.fingerprint!==fingerprint){
      reservationAttempt.current={fingerprint,key:crypto.randomUUID()}
    }
    const idempotencyKey=reservationAttempt.current.key
    setSubmitting(true)
    setReservationResult('idle')
    setQuoteError(false)
    setQuotePreview(null)
    setCheckoutId(null)
    setFinalOrder(null)
    setPreflightStatus('idle')
    setClaimStatus('idle')
    claimAttempt.current=null
    try{
      const response=await fetch('/api/store/checkout/reserve',{
        method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({items,address_id:selectedAddress,idempotency_key:idempotencyKey}),
      })
      if(!response.ok){setReservationResult('failed');return}
      const payload:unknown=await response.json()
      if(!payload||typeof payload!=='object'||!('reservation' in payload)||!payload.reservation){
        setReservationResult('failed');return
      }
      const reservation=(payload as {reservation:unknown}).reservation
      const id=reservation&&typeof reservation==='object'&&'id' in reservation
        &&typeof reservation.id==='string'?reservation.id:null
      if(!id){setReservationResult('failed');return}
      setCheckoutId(id)
      setReservationResult('created')
      setQuotePreview(null)
      if(id){
        try{
          const response=await fetch('/api/store/checkout/quote',{
            method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({checkout_id:id}),
          })
          const result:unknown=await response.json()
          if(response.ok&&result&&typeof result==='object'&&'quote' in result){
            const q=(result as {quote:NonpayableQuote}).quote
            if(q&&q.quote_payable===false&&q.checkout_id===id){setQuotePreview(q);return}
          }
        }catch{}
      }
      setQuoteError(true)
    }catch{setReservationResult('failed')}
    finally{setSubmitting(false)}
  }
  async function finalizeOrder(){
    if(!reservationEnabled||!finalizationEnabled||!checkoutId||!quotePreview||finalizing||finalOrder)return
    setFinalizing(true)
    setFinalError(false)
    try{
      const response=await fetch('/api/store/checkout/finalize',{
        method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({checkout_id:checkoutId}),
      })
      if(!response.ok){setFinalError(true);return}
      const result:unknown=await response.json()
      if(!result||typeof result!=='object'||!('order' in result)){setFinalError(true);return}
      const o=(result as {order:unknown}).order
      if(!o||typeof o!=='object'||!('order_id' in o)||!('amount' in o)||!('currency' in o)
        ||!('payment_enabled' in o)||o.payment_enabled!==false
        ||typeof o.order_id!=='string'||typeof o.currency!=='string'||typeof o.amount!=='string'){
        setFinalError(true);return
      }
      setFinalOrder({order_id:o.order_id,currency:o.currency,amount:o.amount})
      setPreflightStatus('idle')
      setClaimStatus('idle')
    }catch{setFinalError(true)}
    finally{setFinalizing(false)}
  }
  async function checkPaymentReadiness(){
    if(!paymentPreflightEnabled||!finalOrder||preflightStatus==='checking')return
    setPreflightStatus('checking')
    try{
      const response=await fetch('/api/store/checkout/payment-preflight',{
        method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({order_id:finalOrder.order_id}),
      })
      if(!response.ok){setPreflightStatus('unavailable');return}
      const result:unknown=await response.json()
      if(!result||typeof result!=='object'||!('preflight' in result)){setPreflightStatus('unavailable');return}
      const p=(result as {preflight:unknown}).preflight
      if(!p||typeof p!=='object'||!('order_id' in p)||!('amount' in p)
        ||!('currency' in p)||!('payment_ready' in p)
        ||!('requires_provider_capability_check' in p)
        ||p.order_id!==finalOrder.order_id||p.amount!==finalOrder.amount
        ||p.currency!==finalOrder.currency||p.payment_ready!==false
        ||p.requires_provider_capability_check!==true){
        setPreflightStatus('unavailable');return
      }
      setPreflightStatus('reviewed')
    }catch{setPreflightStatus('unavailable')}
  }
  async function claimPaymentIntent(){
    if(!intentClaimEnabled||!finalOrder||preflightStatus!=='reviewed'
      ||claimStatus==='claiming'||claimStatus==='reserved')return
    if(claimAttempt.current?.orderId!==finalOrder.order_id)
      claimAttempt.current={orderId:finalOrder.order_id,key:crypto.randomUUID()}
    setClaimStatus('claiming')
    try{
      const response=await fetch('/api/store/checkout/claim-intent',{
        method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({order_id:finalOrder.order_id,idempotency_key:claimAttempt.current.key}),
      })
      if(!response.ok){setClaimStatus('unavailable');return}
      const result:unknown=await response.json()
      if(!result||typeof result!=='object'||!('intent' in result)){setClaimStatus('unavailable');return}
      const p=(result as {intent:unknown}).intent
      if(!p||typeof p!=='object'||!('order_id' in p)||!('amount' in p)
        ||!('currency' in p)||!('provider_order_created' in p)||!('payment_ready' in p)
        ||p.order_id!==finalOrder.order_id||p.amount!==finalOrder.amount
        ||p.currency!==finalOrder.currency||p.provider_order_created!==false||p.payment_ready!==false){
        setClaimStatus('unavailable');return
      }
      setClaimStatus('reserved')
    }catch{setClaimStatus('unavailable')}
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-12">
    <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Evo Store · Checkout foundation</p>
    <h1 className="text-3xl font-semibold">Review your physical order</h1>
    <p className="text-zinc-300">{reservationEnabled?'Controlled unpaid checkout reservation pilot. Payments are not available yet.':'This is an order-readiness preview. Payment and order submission are not yet available.'}</p>
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
    {reservationEnabled&&isHydrated&&items.length>0&&<section className="space-y-3 border border-white/20 p-5">
      <h2 className="text-lg font-semibold">Shipping address</h2>
      {addressLoadFailed?<p role="alert">Unable to load saved addresses.</p>
      :addresses.length===0?<p>No saved addresses available. Sign in and add an address before reserving.</p>
      :<label className="block text-sm">Choose a saved address
        <select className="mt-2 block w-full border border-white/30 bg-zinc-900 p-3" value={selectedAddress} onChange={e=>setAddressId(e.target.value)}>
          {addresses.map((address,index)=><option key={address.id} value={address.id}>{address.is_default?'Default shipping address':'Saved address '+(index+1)}</option>)}
        </select>
      </label>}
      {reservationResult==='created'&&<p role="status" className="text-amber-300">Reservation request accepted. This is not a paid order.</p>}
      {reservationResult==='failed'&&<p role="alert">Reservation failed. Review your cart and shipping details.</p>}
      {quotePreview&&<div role="status" className="space-y-2 border border-amber-300/30 p-4">
        <h3 className="font-semibold">Shipping and tax preview — not payable</h3>
        <p>Destination: {quotePreview.country} · Currency: {quotePreview.currency}</p>
        <p>Product subtotal (includes product tax): {String(quotePreview.subtotal_tax_inclusive)}</p>
        <p>Included product tax: {String(quotePreview.included_product_tax)}</p>
        <p>Shipping before applicable shipping tax: {String(quotePreview.shipping_before_any_applicable_shipping_tax)}</p>
        <p>Shipping tax still requires validation. No final payable total is available.</p>
      </div>}
      {quoteError&&reservationResult==='created'&&<p role="alert">Reservation recorded, but shipping and tax preview is unavailable. No payment can be made.</p>}
      {finalizationEnabled&&quotePreview&&checkoutId&&!finalOrder&&<button type="button" className="button-primary px-4 py-3" disabled={finalizing} onClick={()=>void finalizeOrder()}>{finalizing?'Finalizing…':'Finalize order — no payment'}</button>}
      {finalError&&<p role="alert">Final order charges are unavailable or have changed. No payment was initiated.</p>}
      {intentClaimEnabled&&finalOrder&&preflightStatus==='reviewed'&&<div className="space-y-2">
        <button type="button" className="button-secondary px-4 py-3" disabled={claimStatus==='claiming'||claimStatus==='reserved'} onClick={()=>void claimPaymentIntent()}>{claimStatus==='claiming'?'Reserving intent…':'Reserve payment intent — no charge'}</button>
        {claimStatus==='reserved'&&<p role="status">Internal intent reserved. No Razorpay order or payment was created.</p>}
        {claimStatus==='unavailable'&&<p role="alert">Intent reservation could not be confirmed. No charge was attempted.</p>}
      </div>}
      {paymentPreflightEnabled&&finalOrder&&<div className="space-y-2">
        <button type="button" className="button-secondary px-4 py-3" disabled={preflightStatus==='checking'} onClick={()=>void checkPaymentReadiness()}>{preflightStatus==='checking'?'Checking…':'Check payment readiness — no charge'}</button>
        {preflightStatus==='reviewed'&&<p role="status">Order passed database preflight. Provider capability verification and actual payment activation are still required.</p>}
        {preflightStatus==='unavailable'&&<p role="alert">Payment readiness could not be confirmed. No charge was attempted.</p>}
      </div>}
      {finalOrder&&<div role="status" className="space-y-2 border border-amber-300/30 p-4">
        <h3 className="font-semibold">Final order total — payment disabled</h3>
        <p>Order: {finalOrder.order_id}</p>
        <p>Final amount: {finalOrder.currency} {finalOrder.amount}</p>
        <p>This order is pending and has not been paid. No fulfilment is initiated.</p>
      </div>}
      <button type="button" className="button-primary px-4 py-3" disabled={!readiness?.readyForOrderAttempt||!selectedAddress||addressLoadFailed||submitting||reservationResult==='created'} onClick={()=>void reserveOrder()}>{submitting?'Reserving…':'Reserve order — no payment'}</button>
    </section>}
    <div className="flex flex-wrap gap-3"><Link className="button-secondary px-4 py-3" href="/store/cart">Back to cart</Link>
      <button type="button" disabled className="button-primary px-4 py-3 opacity-40">Payment unavailable — testing in progress</button></div>
  </main>
}
