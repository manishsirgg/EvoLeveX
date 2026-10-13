'use client'
import { useState } from 'react'
import { previewPrintfulCatalogReconciliation } from './actions'
type Preview = Awaited<ReturnType<typeof previewPrintfulCatalogReconciliation>>
export function CatalogReconciliationPreview() {
  const [result,setResult] = useState<Preview|null>(null)
  const [pending,setPending] = useState(false)
  async function inspect() {
    if (pending) return
    setPending(true);setResult(null)
    try { setResult(await previewPrintfulCatalogReconciliation()) }
    catch { setResult({ok:false,code:'PREVIEW_UNAVAILABLE'}) }
    finally { setPending(false) }
  }
  return <section className="mt-6 border border-amber-400/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Catalog reconciliation preview</h2>
    <p className="mt-2 text-sm text-zinc-400">Matches Printful sync IDs to existing Evo Store product slugs. No imports, updates, publishing, prices, images or orders are changed.</p>
    <button className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50" disabled={pending} onClick={inspect} type="button">{pending ? 'Checking…' : 'Preview catalog sync (no changes)'}</button>
    {result && (!result.ok ? <p className="mt-3 text-amber-300" role="status">Preview unavailable: {result.code}</p> :
      <div className="mt-4"><p className="text-emerald-300" role="status">{result.items.length} candidate(s) classified.</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-white/20"><th className="p-2">Printful ID</th><th className="p-2">Product</th><th className="p-2">Variants</th><th className="p-2">Next action</th></tr></thead><tbody>
          {result.items.map(item=><tr className="border-b border-white/10" key={item.syncProductId}><td className="p-2">{item.syncProductId}</td><td className="p-2">{item.title}</td><td className="p-2">{item.variants}</td><td className="p-2">{item.action === 'EXISTS' ? 'Existing — preserve' : item.action === 'NEW_DRAFT' ? 'Eligible for future draft import' : 'Manual review required'}</td></tr>)}
        </tbody></table></div><p className="mt-3 text-sm text-amber-200">{result.note}</p></div>)}
  </section>
}
