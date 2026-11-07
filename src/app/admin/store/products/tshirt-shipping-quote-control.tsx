'use client'
import {useState} from 'react'
import type {StoreAdminProductVariant} from '@/lib/admin-store'
import {inspectVerifiedTshirtShipping} from './tshirt-shipping-quote-action'
import type {VariantShippingQuoteResult} from '@/lib/printful/verified-variant-shipping'

export function TshirtShippingQuoteControl({variants,enabled}:{
 variants:Pick<StoreAdminProductVariant,'id'|'sku'>[];enabled:boolean
}){
 const [variantId,setVariantId]=useState(variants[0]?.id??'')
 const [country,setCountry]=useState<'IN'|'US'>('IN')
 const [state,setState]=useState('')
 const [postal,setPostal]=useState('')
 const [city,setCity]=useState('')
 const [quantity,setQuantity]=useState(1)
 const [pending,setPending]=useState(false)
 const [result,setResult]=useState<VariantShippingQuoteResult|null>(null)
 async function inspect(){
  if(!enabled||pending||!variantId||!window.confirm(
   'Send a non-order, one-line Printful shipping-rate request for this SKU and illustrative destination? No purchase or inventory reservation will be made.'
  ))return
  setPending(true);setResult(null)
  try{setResult(await inspectVerifiedTshirtShipping({
   localVariantId:variantId,country,state,postal,city,quantity,
  }))}
  catch{setResult({ok:false,code:'PROVIDER_UNAVAILABLE'})}
  finally{setPending(false)}
 }
 return <section className="mt-8 border border-amber-300/30 p-5 sm:p-7" aria-labelledby="tshirt-shipping-quote-heading">
  <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Staff-only shipping verification</p>
  <h2 id="tshirt-shipping-quote-heading" className="mt-2 text-xl font-semibold">Variant-specific destination shipping quote</h2>
  <p className="mt-2 text-sm text-zinc-400">A verified local SKU is mapped to its Printful catalog variant before one non-order shipping-rate request. Use illustrative destination details, not personal customer addresses. Quotes are not saved or charged.</p>
  {!enabled?<p role="status" className="mt-4 text-sm text-amber-200">Disabled until PRINTFUL_VARIANT_SHIPPING_QUOTES_ENABLED is explicitly enabled for a reviewed administrative test.</p>:
  <div className="mt-5 grid gap-4 sm:grid-cols-2">
   <label className="text-sm">T-shirt SKU<select className="mt-2 block w-full border border-white/20 bg-black p-3" value={variantId} onChange={e=>{setVariantId(e.target.value);setResult(null)}}>
    {variants.map(v=><option key={v.id} value={v.id}>{v.sku}</option>)}
   </select></label>
   <label className="text-sm">Destination country<select className="mt-2 block w-full border border-white/20 bg-black p-3" value={country} onChange={e=>{setCountry(e.target.value==='US'?'US':'IN');setState('');setResult(null)}}>
    <option value="IN">India</option><option value="US">United States</option>
   </select></label>
   <label className="text-sm">State {country==='US'?'(required, 2-letter code)':'(optional, 2-letter code)'}
    <input maxLength={2} placeholder={country==='US'?'CA':'MP'} className="mt-2 block w-full border border-white/20 bg-black p-3" value={state} onChange={e=>setState(e.target.value.toUpperCase())}/></label>
   <label className="text-sm">Postal code<input maxLength={16} required placeholder={country==='US'?'94103':'452001'} className="mt-2 block w-full border border-white/20 bg-black p-3" value={postal} onChange={e=>setPostal(e.target.value)}/></label>
   <label className="text-sm">City<input maxLength={100} required placeholder={country==='US'?'San Francisco':'Indore'} className="mt-2 block w-full border border-white/20 bg-black p-3" value={city} onChange={e=>setCity(e.target.value)}/></label>
   <label className="text-sm">Quantity (1–10)<input type="number" min={1} max={10} step={1} className="mt-2 block w-full border border-white/20 bg-black p-3" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
   <div className="sm:col-span-2"><button type="button" onClick={()=>void inspect()} disabled={pending||!variantId||!postal.trim()||!city.trim()||(country==='US'&&!state.trim())} className="button-secondary px-4 py-3 text-sm disabled:opacity-40">{pending?'Requesting shipping options…':'Inspect shipping options (no order)'}</button></div>
  </div>}
  {result&&!result.ok?<p role="alert" className="mt-4 text-sm text-amber-200">Shipping quote not available: {result.code}. No fulfilment action occurred.</p>:null}
  {result?.ok?<div className="mt-4 space-y-3">
   <p role="status" className="text-sm text-emerald-300">Verified SKU: {result.sku} · Printful catalog variant: {result.catalogVariantId}</p>
   {result.options.length?<ul className="space-y-2 text-sm">{result.options.map(o=><li key={o.id} className="border border-white/10 p-3">{o.name}: {o.rate} {o.currency}</li>)}</ul>:<p className="text-amber-200">Printful returned no shipping options for this request.</p>}
   <p className="text-xs leading-5 text-amber-200">{result.note}</p>
  </div>:null}
 </section>
}
