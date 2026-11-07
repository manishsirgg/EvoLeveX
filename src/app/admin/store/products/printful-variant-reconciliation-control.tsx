'use client'

import {useState} from 'react'
import {inspectStoreTshirtPrintfulVariantMapping,type ReconciliationInspection} from './printful-variant-reconciliation-action'

export function PrintfulVariantReconciliationControl(){
 const [result,setResult]=useState<ReconciliationInspection|null>(null)
 const [pending,setPending]=useState(false)
 async function inspect(){
  if(pending)return
  setPending(true);setResult(null)
  try{setResult(await inspectStoreTshirtPrintfulVariantMapping())}
  catch{setResult({ok:false,code:'PRINTFUL_UNAVAILABLE'})}
  finally{setPending(false)}
 }
 return <section aria-labelledby="printful-reconciliation-heading" className="mt-8 border border-amber-300/30 p-5 sm:p-7">
  <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Live provider comparison</p>
  <h2 id="printful-reconciliation-heading" className="mt-2 text-xl font-semibold">Verify 18 T-shirt variant mappings</h2>
  <p className="mt-2 text-sm leading-6 text-zinc-400">Compare each locally stored SKU with Printful’s synchronized product. This reads live provider data but never writes inventory, products, prices or orders.</p>
  <button type="button" disabled={pending} onClick={()=>void inspect()} className="button-secondary mt-4 px-4 py-3 text-sm font-semibold">
   {pending?'Checking Printful…':'Inspect variant mapping (read-only)'}
  </button>
  {result && (!result.ok?<p role="alert" className="mt-4 text-sm text-amber-200">Verification unavailable: {result.code}. No changes made.</p>:
   <div className="mt-5 space-y-4">
    <p role="status" className={result.result.readyForMapping?'text-emerald-300':'text-amber-200'}>
     {result.result.readyForMapping?'SKU identities match; fulfilment remains unverified.':'Variant mapping needs review before fulfilment.'}
    </p>
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
     {([['Local variants',result.result.totalLocal],['Printful variants',result.result.totalProvider],['Matched SKUs',result.result.matched]] as const).map(([title,value])=>
      <div key={title} className="border border-white/10 p-3"><dt className="text-zinc-400">{title}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd></div>)}
    </dl>
    {([
     ['Unmatched local SKUs',result.result.unmatchedLocal],
     ['Unmatched Printful SKUs',result.result.unmatchedProvider],
     ['Duplicate local SKUs',result.result.duplicateLocal],
     ['Duplicate Printful SKUs',result.result.duplicateProvider],
     ['Unsynced Printful variants',result.result.unsynced],
    ] as const).map(([title,values])=><div key={title} className="border border-white/10 p-3">
     <h3 className="text-sm font-semibold">{title}: {values.length}</h3>
     {values.length?<ul className="mt-2 space-y-1 text-xs text-amber-200">{values.map((v,i)=><li key={`${v}-${i}`} className="break-all font-mono">{v}</li>)}</ul>:<p className="mt-1 text-xs text-zinc-400">None</p>}
    </div>)}
    <p className="text-xs text-amber-200">{result.note}</p>
   </div>)}
 </section>
}
