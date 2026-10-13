'use client'

import { useState } from 'react'
import { inspectExistingBlackSFileMetadata } from './actions'
import type { BlackSFileAuditResult } from '@/lib/printful/black-s-file-audit'

export function BlackSFileAuditControl() {
  const [result, setResult] = useState<BlackSFileAuditResult | null>(null)
  const [pending, setPending] = useState(false)
  async function inspect() {
    if (pending) return
    setPending(true)
    setResult(null)
    try { setResult(await inspectExistingBlackSFileMetadata()) }
    catch { setResult({ ok: false, code: 'PRODUCT_UNAVAILABLE' }) }
    finally { setPending(false) }
  }
  return <section className="mt-8 border border-amber-400/30 p-5 sm:p-7" aria-labelledby="black-s-audit-heading">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Read-only file metadata audit</p>
    <h2 id="black-s-audit-heading" className="mt-2 text-xl font-semibold">Black / S production-file suitability checkpoint</h2>
    <p className="mt-2 text-sm text-zinc-400">Inspects existing synchronized variant 5562164619 only. Reports placement, file identity, dimensions, DPI and MIME when present in provider metadata. Never downloads artwork, exposes URLs, creates orders or modifies products.</p>
    <button type="button" disabled={pending} onClick={inspect} className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50">{pending ? 'Inspecting…' : 'Inspect Black / S file metadata (no changes)'}</button>
    {result && (!result.ok ? <p role="status" className="mt-4 text-sm text-amber-300">Inspection unavailable: {result.code}</p> :
      <div className="mt-4">
        <p role="status" className="text-emerald-300">{result.files.length} provider file association(s) examined. Sync ID {result.syncVariantId}; catalog ID {result.catalogVariantId}.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b border-white/20"><th className="p-2">Placement</th><th className="p-2">File ID</th><th className="p-2">Purpose</th><th className="p-2">Dimensions</th><th className="p-2">DPI</th><th className="p-2">MIME</th><th className="p-2">Bytes</th><th className="p-2">Options</th></tr></thead>
          <tbody>{result.files.map((f,i) => <tr key={i} className="border-b border-white/10 align-top">
            <td className="p-2">{f.placement}</td><td className="p-2">{f.fileId ?? 'Unknown'}</td><td className="p-2">{f.kind}</td>
            <td className="p-2">{f.width && f.height ? `${f.width} × ${f.height}` : 'Not reported'}</td>
            <td className="p-2">{f.dpi ?? 'Not reported'}</td><td className="p-2">{f.mimeType ?? 'Not reported'}</td>
            <td className="p-2">{f.sizeBytes ?? 'Not reported'}</td><td className="p-2">{f.optionsCount ?? 'Not reported'}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="mt-3 text-sm text-amber-200">{result.conclusion}</p>
        {result.files.map((f,i) => <p key={i} className="mt-1 text-xs text-zinc-400">{f.placement}: {f.note}</p>)}
      </div>)}
  </section>
}
