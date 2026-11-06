'use client'
import {useState,useTransition} from 'react'
import {useRouter} from 'next/navigation'
import type {StoreAdminProductVariant} from '@/lib/admin-store'
import {saveVerifiedDraftWeights} from './bulk-draft-weight-actions'

export function BulkDraftWeightManager({productId,variants}:{productId:string;variants:StoreAdminProductVariant[]}){
 const router=useRouter()
 const [expanded,setExpanded]=useState(false)
 const [weights,setWeights]=useState<Record<string,string>>({})
 const [confirmed,setConfirmed]=useState(false)
 const [result,setResult]=useState<{error?:string;success?:string}>({})
 const [pending,startTransition]=useTransition()
 const alreadyConfigured=variants.filter(v=>v.weight_g!==null)
 const canSave=variants.length>0&&variants.length<=50&&alreadyConfigured.length===0
  &&variants.every(v=>/^[1-9][0-9]{0,9}$/.test(weights[v.id]??'')
   &&Number(weights[v.id])<=2147483647)
 return <section className="mt-8 border border-amber-300/30 p-5 sm:p-7">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div><h2 className="text-xl font-semibold">Bulk shipping weights</h2>
    <p className="mt-2 text-sm text-zinc-400">Enter verified packed shipping weights in grams for every variant. Do not infer weights from a product name or Printful catalog price.</p></div>
   <button type="button" className="button-secondary px-4 py-2 text-sm" onClick={()=>setExpanded(x=>!x)}>{expanded?'Close weight editor':'Prepare verified weights'}</button>
  </div>
  {expanded?<div className="mt-5 space-y-4">
   {alreadyConfigured.length>0?<p role="alert" className="text-sm text-amber-200">{alreadyConfigured.length} variant(s) already have weights. This bulk operation refuses to overwrite existing values; use the individual variant editors instead.</p>:null}
   {variants.length>50?<p role="alert" className="text-sm text-amber-200">Bulk editing is limited to 50 variants.</p>:null}
   <div className="max-h-[30rem] overflow-auto border border-white/10">
    <table className="w-full min-w-[430px] text-left text-sm">
     <thead className="sticky top-0 bg-zinc-900"><tr><th className="p-3">SKU</th><th className="p-3">Variant</th><th className="p-3">Verified grams</th></tr></thead>
     <tbody className="divide-y divide-white/10">{variants.map(v=><tr key={v.id}>
      <td className="p-3 font-mono text-xs">{v.sku}</td>
      <td className="p-3 text-xs text-zinc-400">{[v.size_code,v.color_code].filter(Boolean).join(' / ')||'—'}</td>
      <td className="p-3"><input aria-label={`Verified packed weight in grams for ${v.sku}`}
       type="number" min="1" max="2147483647" step="1" inputMode="numeric"
       value={weights[v.id]??''} disabled={pending||alreadyConfigured.length>0}
       onChange={e=>{setWeights(old=>({...old,[v.id]:e.target.value}));setConfirmed(false)}}
       className="w-32 border border-white/20 bg-black p-2 text-white"/></td>
     </tr>)}</tbody>
    </table>
   </div>
   <label className="flex gap-2 text-sm text-zinc-300"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
    I verified every packed shipping weight with reliable supplier/product evidence and authorize the saved grams for these exact SKUs.</label>
   <button type="button" className="button-primary px-5 py-3 text-sm disabled:opacity-40"
    disabled={!canSave||!confirmed||pending}
    onClick={()=>{if(!window.confirm(`Save ${variants.length} verified shipping weights? Review all SKUs first.`))return
     startTransition(async()=>{setResult({});const outcome=await saveVerifiedDraftWeights(productId,
      variants.map(v=>({variant_id:v.id,weight_g:Number(weights[v.id])})),confirmed)
      setResult(outcome);if(outcome.success)router.refresh()})}}>
    {pending?'Saving weights…':`Save ${variants.length} verified weights`}</button>
   {result.error?<p role="alert" className="text-sm text-rose-200">{result.error}</p>:null}
   {result.success?<p role="status" className="text-sm text-emerald-300">{result.success}</p>:null}
   <p className="text-xs text-amber-200">Weight setup does not prove Printful fulfilment, reserve stock, activate prices or enable checkout.</p>
  </div>:null}
 </section>
}
