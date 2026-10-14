'use client'
import { useState } from 'react'
import { previewHoodieSynchronizationPlan } from './actions'
type Plan = Awaited<ReturnType<typeof previewHoodieSynchronizationPlan>>
export function HoodieReconciliationPlan() {
  const [plan,setPlan] = useState<Plan|null>(null)
  const [pending,setPending]=useState(false)
  async function inspect() {
    if(pending) return
    setPending(true);setPlan(null)
    try {setPlan(await previewHoodieSynchronizationPlan())}
    catch {setPlan({ok:false,code:'PLAN_UNAVAILABLE'})}
    finally {setPending(false)}
  }
  return <section className="mt-6 border border-amber-400/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Hoodie synchronization mapping</h2>
    <p className="mt-2 text-sm text-zinc-400">Reconciles all provider variants and mockup file IDs against the imported Evo Store hoodie. USD has been confirmed by the merchant for this product. This operation does not write prices, images or product records.</p>
    <button type="button" disabled={pending} onClick={inspect} className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50">{pending?'Checking…':'Verify synchronization mapping (no changes)'}</button>
    {plan && (plan.ok ? <div className="mt-4 space-y-3">
      <p role="status" className="text-emerald-300">{plan.prices.length} variant prices matched; {plan.images.length} distinct preview images mapped.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-white/20"><th className="p-2">SKU</th><th className="p-2">Color</th><th className="p-2">Retail price</th></tr></thead><tbody>{plan.prices.map(p=><tr key={p.variantId} className="border-b border-white/10"><td className="p-2">{p.sku}</td><td className="p-2">{p.color}</td><td className="p-2">{p.amount} {p.currency}</td></tr>)}</tbody></table></div>
      <p className="text-sm font-semibold">Preview mappings</p>
      {plan.images.map(p=><p key={p.fileId} className="text-sm">{p.color}: Printful file {p.fileId}{p.primaryCandidate?' (proposed primary)':''}</p>)}
      {plan.warnings.map(w=><p className="text-sm text-amber-300" key={w}>{w}</p>)}
    </div> : <p role="status" className="mt-3 text-amber-300">Mapping unavailable: {plan.code}</p>)}
  </section>
}
