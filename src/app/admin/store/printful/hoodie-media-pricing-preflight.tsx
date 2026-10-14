'use client'
import { useState } from 'react'
import { inspectHoodieMediaAndRetail } from './actions'
type Inspection = Awaited<ReturnType<typeof inspectHoodieMediaAndRetail>>
export function HoodieMediaPricingPreflight() {
  const [result,setResult]=useState<Inspection|null>(null)
  const [pending,setPending]=useState(false)
  async function inspect() {
    if(pending)return
    setPending(true);setResult(null)
    try {setResult(await inspectHoodieMediaAndRetail())}
    catch {setResult({ok:false,code:'INSPECTION_UNAVAILABLE'})}
    finally {setPending(false)}
  }
  return <section className="mt-6 border border-amber-400/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Hoodie mockups & retail pricing</h2>
    <p className="mt-2 text-sm text-zinc-400">Inspect source data for the imported Under Armour® hoodie before synchronizing images and merchant prices. No files, prices or inventory will be modified.</p>
    <button type="button" disabled={pending} onClick={inspect} className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50">{pending?'Inspecting…':'Inspect Printful hoodie source data (read-only)'}</button>
    {result && (result.ok ? <div className="mt-4 space-y-3">
      <p role="status" className="text-emerald-300">{result.variantCount} variants, {result.mockupCount} distinct preview file(s).</p>
      <p className="text-sm text-amber-200">{result.note}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-white/20"><th className="p-2">Sync variant</th><th className="p-2">SKU</th><th className="p-2">Printful retail</th><th className="p-2">Validation</th></tr></thead><tbody>{result.prices.map(p=><tr key={p.syncId} className="border-b border-white/10"><td className="p-2">{p.syncId}</td><td className="p-2">{p.sku ?? '—'}</td><td className="p-2">{p.retailPrice ?? 'Missing'}</td><td className="p-2">{p.state === 'MISSING'?'Missing/invalid':'Currency unverified'}</td></tr>)}</tbody></table></div>
    </div> : <p role="status" className="mt-3 text-amber-300">Inspection unavailable: {result.code}</p>)}
  </section>
}
