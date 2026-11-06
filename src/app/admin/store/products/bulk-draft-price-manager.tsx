'use client'
import {useState,useTransition} from 'react'
import {useRouter} from 'next/navigation'
import type {StoreAdminProductVariant} from '@/lib/admin-store'
import {SUPPORTED_CURRENCIES} from '@/lib/currency'
import {saveBulkInactiveDraftPrices} from './bulk-draft-price-actions'

export function BulkDraftPriceManager({productId,variants}:{productId:string;variants:StoreAdminProductVariant[]}){
 const router=useRouter()
 const [expanded,setExpanded]=useState(false)
 const [currency,setCurrency]=useState('USD')
 const [amounts,setAmounts]=useState<Record<string,string>>({})
 const [confirmed,setConfirmed]=useState(false)
 const [result,setResult]=useState<{error?:string;success?:string}>({})
 const [pending,startTransition]=useTransition()
 const existing=variants.filter(v=>v.prices.some(p=>p.currency===currency))
 const valid=variants.length>0&&variants.length<=50&&existing.length===0
  &&variants.every(v=>/^(?:0|[1-9][0-9]{0,9})\.[0-9]{2}$/.test(amounts[v.id]??'')
   &&Number(amounts[v.id])>0&&(currency!=='JPY'||amounts[v.id].endsWith('.00')))
 return <section className="mt-8 border border-amber-300/30 p-5 sm:p-7">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div><h2 className="text-xl font-semibold">Bulk draft prices</h2>
    <p className="mt-2 text-sm text-zinc-400">Enter merchant-verified retail prices for all {variants.length} variants in one currency. Prices are created inactive, never automatically published or charged.</p></div>
   <button type="button" onClick={()=>setExpanded(v=>!v)} className="button-secondary px-4 py-2 text-sm">{expanded?'Close pricing editor':'Prepare draft prices'}</button>
  </div>
  {expanded?<div className="mt-5 space-y-4">
   <label className="block text-sm">Currency
    <select value={currency} onChange={e=>{setCurrency(e.target.value);setConfirmed(false);setResult({})}} className="ml-3 border border-white/20 bg-black px-3 py-2">
     {SUPPORTED_CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}
    </select>
   </label>
   {existing.length?<p role="alert" className="text-sm text-amber-200">{existing.length} variant(s) already have a {currency} price. To prevent duplicate or partial writes, edit existing prices individually or choose another currency.</p>:null}
   {variants.length>50?<p role="alert" className="text-sm text-amber-200">Bulk entry is limited to 50 variants. Use individual editors for this product.</p>:null}
   <div className="max-h-[30rem] overflow-auto border border-white/10">
    <table className="w-full min-w-[430px] text-left text-sm">
     <thead className="sticky top-0 bg-zinc-900"><tr><th className="p-3">SKU</th><th className="p-3">Size / color</th><th className="p-3">Verified {currency} price</th></tr></thead>
     <tbody className="divide-y divide-white/10">{variants.map(v=><tr key={v.id}>
      <td className="p-3 font-mono text-xs">{v.sku}</td>
      <td className="p-3 text-xs text-zinc-400">{[v.size_code,v.color_code].filter(Boolean).join(' / ')||'—'}</td>
      <td className="p-3"><input type="text" inputMode="decimal" aria-label={`Retail price for ${v.sku}`}
       placeholder="0.00" maxLength={14} disabled={pending||existing.length>0}
       value={amounts[v.id]??''} onChange={e=>{setAmounts(x=>({...x,[v.id]:e.target.value}));setConfirmed(false)}}
       className="w-32 border border-white/20 bg-black p-2 text-white"/></td>
     </tr>)}</tbody>
    </table>
   </div>
   <label className="flex gap-2 text-sm text-zinc-300"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
    I verified each retail price, currency and supplier landed cost; I authorize inactive draft creation only.</label>
   <button type="button" disabled={!confirmed||!valid||pending} className="button-primary px-5 py-3 text-sm disabled:opacity-40"
    onClick={()=>{if(!window.confirm(`Create ${variants.length} inactive ${currency} draft price records? This does not activate them.`))return
     startTransition(async()=>{setResult({});const response=await saveBulkInactiveDraftPrices(productId,currency,
      variants.map(v=>({variant_id:v.id,amount:amounts[v.id]})),confirmed);setResult(response);if(response.success)router.refresh()})}}>
    {pending?'Saving drafts…':`Save ${variants.length} inactive draft prices`}</button>
   {result.error?<p role="alert" className="text-sm text-rose-200">{result.error}</p>:null}
   {result.success?<p role="status" className="text-sm text-emerald-300">{result.success}</p>:null}
   <p className="text-xs text-amber-200">For Printful goods, retail prices must include validated production, decoration, shipping, taxes and payment costs. Do not use catalog base prices as final retail prices.</p>
  </div>:null}
 </section>
}
