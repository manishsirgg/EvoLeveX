'use client'
import {useState} from 'react'
import {inspectTshirtProductionPreflight,type TshirtProductionInspection} from './tshirt-production-preflight-action'

const ISSUE_LABELS={
 SKU_NOT_MATCHED:'SKU missing or ambiguous',
 PROVIDER_NOT_SYNCED:'Printful variant not synchronized',
 PRODUCTION_FILES_MISSING:'No production files reported',
 PRODUCTION_FILES_UNKNOWN:'Production-file evidence unavailable',
 PRODUCTION_FILE_ID_MISSING:'Production file ID missing',
 CATALOG_VARIANT_MISSING:'Printful catalog variant ID missing',
 WEIGHT_MISSING:'Local shipping weight missing',
 ACTIVE_PRICE_MISSING:'No active positive retail price',
 INVENTORY_UNCONFIGURED:'Local inventory record not configured',
 LOCAL_VARIANT_ACTIVE:'Locally active variant — review publication lock',
 PROVIDER_VARIANT_DUPLICATE:'Duplicate provider SKU',
} as const

export function TshirtProductionPreflightControl(){
 const [state,setState]=useState<TshirtProductionInspection|null>(null)
 const [pending,setPending]=useState(false)
 async function inspect(){
  if(pending)return
  setPending(true);setState(null)
  try{setState(await inspectTshirtProductionPreflight())}
  catch{setState({ok:false,code:'PROVIDER_UNAVAILABLE'})}
  finally{setPending(false)}
 }
 return <section aria-labelledby="printful-production-preflight" className="mt-8 border border-amber-300/30 p-5 sm:p-7">
  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">Evo Store · Read-only production audit</p>
  <h2 id="printful-production-preflight" className="mt-2 text-xl font-semibold">T-shirt production preflight</h2>
  <p className="mt-2 text-sm text-zinc-400">Inspect the 18 local variants against live Printful synchronized SKU, file/placement metadata and configured local weight, price and inventory records. This check does not create stock, products, payments or fulfilment orders.</p>
  <button type="button" className="button-secondary mt-4 px-4 py-3 text-sm" disabled={pending} onClick={()=>void inspect()}>{pending?'Checking production evidence…':'Run production preflight'}</button>
  {state&&!state.ok?<p role="alert" className="mt-4 text-sm text-amber-200">Preflight unavailable: {state.code}. Nothing was modified.</p>:null}
  {state?.ok?<div className="mt-5 space-y-4">
   <dl className="grid gap-3 sm:grid-cols-3">
    <div className="border border-white/10 p-3"><dt className="text-xs text-zinc-400">Variants examined</dt><dd className="text-xl font-semibold">{state.summary.examined}</dd></div>
    <div className="border border-white/10 p-3"><dt className="text-xs text-zinc-400">SKU mapping</dt><dd className={state.summary.mappingMatches?'text-emerald-300':'text-amber-200'}>{state.summary.mappingMatches?'Matches':'Needs review'}</dd></div>
    <div className="border border-white/10 p-3"><dt className="text-xs text-zinc-400">Metadata evidence</dt><dd className={state.summary.productionEvidenceComplete?'text-emerald-300':'text-amber-200'}>{state.summary.productionEvidenceComplete?'Present':'Incomplete'}</dd></div>
   </dl>
   <p role="status" className="text-sm text-amber-200">Commercial fulfilment authorization: NOT GRANTED. {state.summary.issues.length} setup or evidence issue(s) identified.</p>
   {state.summary.issues.length?<div className="max-h-[30rem] overflow-auto border border-white/10">
    <table className="w-full min-w-[400px] text-left text-sm"><thead className="sticky top-0 bg-zinc-900"><tr><th className="p-3">SKU</th><th className="p-3">Issue</th></tr></thead><tbody className="divide-y divide-white/10">
    {state.summary.issues.map((issue,i)=><tr key={issue.sku+'-'+issue.code+'-'+i}><td className="p-3 font-mono text-xs">{issue.sku}</td><td className="p-3 text-amber-100">{ISSUE_LABELS[issue.code]}</td></tr>)}
    </tbody></table></div>
   :<p className="text-sm text-emerald-300">No listed setup issues. Independent financial, production and fulfilment approval still required.</p>}
   <p className="text-xs leading-5 text-amber-200">{state.note}</p>
  </div>:null}
 </section>
}
