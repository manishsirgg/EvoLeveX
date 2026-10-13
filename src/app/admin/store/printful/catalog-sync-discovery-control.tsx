'use client'

import { useState } from 'react'
import { discoverCatalogSyncCandidates } from './actions'
import type { SyncCatalogDiscovery } from '@/lib/printful/catalog-sync-discovery'

export function CatalogSyncDiscoveryControl() {
  const [result, setResult] = useState<SyncCatalogDiscovery | null>(null)
  const [pending, setPending] = useState(false)
  async function inspect() {
    if (pending) return
    setPending(true)
    setResult(null)
    try { setResult(await discoverCatalogSyncCandidates()) }
    catch { setResult({ ok: false, code: 'UPSTREAM_ERROR' }) }
    finally { setPending(false) }
  }
  return <section className="mt-8 border border-amber-400/30 p-5 sm:p-7" aria-labelledby="sync-discovery-heading">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Evo Store · Catalog synchronization foundation</p>
    <h2 id="sync-discovery-heading" className="mt-2 text-xl font-semibold">Discover Printful products</h2>
    <p className="mt-2 text-sm text-zinc-400">Lists all accessible synchronized products in bounded pages to prepare for catalog reconciliation. This step only discovers product IDs, names and variant counts. It does not import, update, publish or enable customer orders.</p>
    <button type="button" disabled={pending} onClick={inspect} className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50">{pending ? 'Discovering…' : 'Discover catalog candidates (read-only)'}</button>
    {result && (!result.ok ? <p role="status" className="mt-4 text-amber-300">Discovery unavailable: {result.code}</p> :
      <div className="mt-4">
        <p role="status" className="text-emerald-300">Discovered {result.products.length} Printful products. {result.truncated ? 'Partial result; reconciliation prohibited.' : 'Pagination complete.'}</p>
        <p className="mt-2 text-sm text-amber-200">{result.note}</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-white/20"><th className="p-2">Sync product ID</th><th className="p-2">Name</th><th className="p-2">Variants</th></tr></thead>
          <tbody>{result.products.map(p=><tr key={p.syncProductId} className="border-b border-white/10"><td className="p-2">{p.syncProductId}</td><td className="p-2">{p.title}</td><td className="p-2">{p.variantCount}</td></tr>)}</tbody></table></div>
      </div>)}
  </section>
}
