'use client'

import { useState } from 'react'
import { inspectPrintfulCostAssessment } from './actions'
import type { PrintfulCostAssessment } from '@/lib/printful/cost-assessment'

export function CostInspectionControl() {
  const [result, setResult] = useState<PrintfulCostAssessment | null>(null)
  const [pending, setPending] = useState(false)
  async function inspect() {
    if (pending) return
    setPending(true)
    setResult(null)
    try { setResult(await inspectPrintfulCostAssessment()) }
    catch { setResult({ ok: false, code: 'INSPECTION_UNAVAILABLE' }) }
    finally { setPending(false) }
  }
  return <section className="mt-8 border border-amber-400/30 p-5 sm:p-7" aria-labelledby="cost-inspection-heading">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Read-only</p>
    <h2 id="cost-inspection-heading" className="mt-2 text-xl font-semibold">Catalog price observations</h2>
    <p className="mt-2 text-sm text-zinc-400">Fetches the existing T-shirt's 18 catalog variants from Printful. These observations are not a shipping quote, landed cost, retail price, inventory feed, or permission to publish.</p>
    <button type="button" className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50" onClick={inspect} disabled={pending}>
      {pending ? 'Inspecting provider catalog…' : 'Inspect catalog prices (no changes)'}
    </button>
    {result && (!result.ok
      ? <p role="status" className="mt-3 text-amber-300">Inspection unavailable: {result.code}. No changes were made.</p>
      : <div className="mt-4">
          <p className="text-sm text-emerald-300">Retrieved {result.items.length} variants; price fields available for {result.priced}.</p>
          <p className="mt-2 text-sm text-amber-200">{result.note}</p>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="border-b border-white/20"><th className="p-2">SKU</th><th className="p-2">Catalog ID</th><th className="p-2">Catalog price</th><th className="p-2">Currency</th></tr></thead>
            <tbody>{result.items.map(item => <tr key={item.catalogVariantId} className="border-b border-white/10">
              <td className="p-2">{item.sku}</td><td className="p-2">{item.catalogVariantId}</td>
              <td className="p-2">{item.providerPrice ?? 'Unavailable'}</td>
              <td className="p-2">{item.currency ?? 'Not supplied'}</td>
            </tr>)}</tbody>
          </table></div>
        </div>)}
  </section>
}
