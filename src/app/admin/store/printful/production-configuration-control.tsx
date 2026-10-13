'use client'

import { useState } from 'react'
import { inspectExistingPrintfulProductionConfiguration } from './actions'
import type { ProductionConfigurationResult } from '@/lib/printful/production-configuration'

export function ProductionConfigurationControl() {
  const [result, setResult] = useState<ProductionConfigurationResult | null>(null)
  const [pending, setPending] = useState(false)
  async function inspect() {
    if (pending) return
    setPending(true)
    setResult(null)
    try { setResult(await inspectExistingPrintfulProductionConfiguration()) }
    catch { setResult({ ok: false, code: 'PRODUCT_UNAVAILABLE' }) }
    finally { setPending(false) }
  }
  return <section className="mt-8 border border-amber-400/30 p-5 sm:p-7" aria-labelledby="production-config-heading">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Read-only production configuration</p>
    <h2 id="production-config-heading" className="mt-2 text-xl font-semibold">Synchronized variant / artwork placement inspection</h2>
    <p className="mt-2 text-sm text-zinc-400">Examines only the existing Printful T-shirt (sync product 479728769). No artwork downloads, uploads, API writes, orders, price changes, or database modifications.</p>
    <button type="button" disabled={pending} onClick={inspect} className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50">{pending ? 'Inspecting…' : 'Inspect synced configuration (no changes)'}</button>
    {result && (!result.ok ? <p role="status" className="mt-4 text-sm text-amber-300">Inspection unavailable: {result.code}</p> :
      <div className="mt-4">
        <p role="status" className="text-emerald-300">{result.variantCount} synchronized variants examined.</p>
        <p className="mt-2 text-sm text-amber-200">{result.note}</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b border-white/20"><th className="p-2">SKU</th><th className="p-2">Sync variant ID</th><th className="p-2">Catalog ID</th><th className="p-2">Synced</th><th className="p-2">Production files / placement</th></tr></thead>
          <tbody>{result.variants.map(v => <tr key={v.syncVariantId} className="border-b border-white/10 align-top">
            <td className="p-2">{v.sku ?? 'Not reported'}</td><td className="p-2">{v.syncVariantId}</td>
            <td className="p-2">{v.catalogVariantId ?? 'Unknown'}</td><td className="p-2">{v.synced ? 'Yes' : 'No'}</td>
            <td className="p-2">{v.evidence === 'CONFIGURATION_UNKNOWN' ? 'Files not reported' : v.evidence === 'NO_FILES_REPORTED' ? 'No files reported' :
              <ul>{v.placements.map(p => <li key={p.placement}>{p.placement}: {p.fileCount} file(s), {p.configuredFileIds} ID(s), {p.unresolvedFileIds} missing ID(s)</li>)}</ul>}</td>
          </tr>)}</tbody>
        </table></div>
      </div>)}
  </section>
}
