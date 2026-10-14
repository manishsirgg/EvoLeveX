'use client'

import { useState } from 'react'
import { previewPrintfulCatalogReconciliation, synchronizeNewPrintfulDraft } from './actions'
type Preview = Awaited<ReturnType<typeof previewPrintfulCatalogReconciliation>>
const CATEGORIES = [
  ['t-shirts','T-Shirts'],['hoodies-sweatshirts','Hoodies & Sweatshirts'],
  ['shirts','Shirts'],['jackets','Jackets'],['bottomwear','Bottomwear'],
] as const

export function DraftSyncControl() {
  const [preview,setPreview] = useState<Preview|null>(null)
  const [pending,setPending] = useState(false)
  const [result,setResult] = useState('')
  const [categories,setCategories] = useState<Record<number,string>>({})
  const [approvals,setApprovals] = useState<Record<number,boolean>>({})
  async function load() {
    if(pending)return
    setPending(true);setResult('')
    try { setPreview(await previewPrintfulCatalogReconciliation()) }
    catch { setResult('PREVIEW_UNAVAILABLE') }
    finally { setPending(false) }
  }
  async function synchronize(id:number) {
    if(pending || !approvals[id] || !categories[id]) return
    if (!window.confirm('Import ONE new Printful product as an unpublished Evo Store draft with inactive variants? Existing products will not be overwritten.')) return
    setPending(true);setResult('')
    try {
      const out=await synchronizeNewPrintfulDraft(id,categories[id])
      setResult(out.ok ? `Draft import completed: ${out.productId}. Review category, variants, images, and prices before publishing.` : `Draft sync not completed: ${out.code}`)
      if(out.ok) setPreview(null)
    } catch { setResult('Draft sync outcome uncertain. Inspect the catalog before trying anything else.') }
    finally { setPending(false) }
  }
  return <section className="mt-6 border border-amber-400/30 p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Import new Printful products as drafts</h2>
    <p className="mt-2 text-sm text-zinc-400">Controlled first sync: review each NEW product, choose its correct category, and import individually. Never overwrites an existing product or publishes it. New variant prices and images require further reconciliation.</p>
    <button type="button" disabled={pending} onClick={load} className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50">{pending?'Working…':'Refresh draft sync candidates'}</button>
    {preview && (preview.ok ? <div className="mt-4 space-y-4">{preview.items.map(p=><div key={p.syncProductId} className="border border-white/15 p-3">
      <p className="font-semibold">{p.title} · {p.variants} variants</p><p className="text-sm text-zinc-400">Printful ID: {p.syncProductId}</p>
      {p.action === 'EXISTS' ? <p className="mt-2 text-sm text-emerald-300">Existing — preserved; no re-import.</p> : p.action === 'REVIEW_CONFLICT' ? <p className="mt-2 text-amber-300">Conflict: manual reconciliation required.</p> :
      <div className="mt-3 space-y-3">
        <label className="block text-sm">Evo Store category (verify product type)
          <select className="mt-1 block w-full max-w-sm border border-white/30 bg-black p-2" value={categories[p.syncProductId]??''} onChange={e=>setCategories(prev=>({...prev,[p.syncProductId]:e.target.value}))}>
            <option value="">Select correct category…</option>{CATEGORIES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!approvals[p.syncProductId]} onChange={e=>setApprovals(prev=>({...prev,[p.syncProductId]:e.target.checked}))}/> I verified this Printful product belongs in the selected category and authorize one draft-only import.</label>
        <button type="button" disabled={pending||!approvals[p.syncProductId]||!categories[p.syncProductId]} onClick={()=>synchronize(p.syncProductId)} className="border border-amber-300 px-3 py-2 text-amber-200 disabled:opacity-40">Import draft once</button>
      </div>}</div>)}</div> : <p className="mt-3 text-amber-300">Preview unavailable: {preview.code}</p>)}
    {result && <p role="status" className="mt-3 text-amber-300">{result}</p>}
  </section>
}
