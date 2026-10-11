'use client'

import { useState } from 'react'
import { inspectPrintfulTokenScopeAudit } from './actions'
import type { PrintfulTokenScopeAudit } from '@/lib/printful/token-scope-audit'

export function TokenScopeAuditControl() {
  const [result, setResult] = useState<PrintfulTokenScopeAudit | null>(null)
  const [pending, setPending] = useState(false)
  async function inspect() {
    if (pending) return
    setPending(true)
    setResult(null)
    try { setResult(await inspectPrintfulTokenScopeAudit()) }
    catch { setResult({ ok: false, code: 'UNAVAILABLE' }) }
    finally { setPending(false) }
  }
  return <section className="mt-8 border border-amber-400/30 p-5 sm:p-7" aria-labelledby="printful-token-audit-heading">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Security audit</p>
    <h2 id="printful-token-audit-heading" className="mt-2 text-xl font-semibold">Token permission inspection</h2>
    <p className="mt-2 text-sm text-zinc-400">Reads the configured token&apos;s OAuth scope names. Never reveals credentials, changes permissions, requests shipping rates, or creates orders.</p>
    <button type="button" onClick={inspect} disabled={pending} className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50">
      {pending ? 'Checking scopes…' : 'Inspect token scopes (no changes)'}
    </button>
    {result && (result.ok ?
      <div role="status" className="mt-4">
        <p className="text-sm text-emerald-300">Token scope endpoint responded; {result.scopes.length} scopes reported.</p>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-200">{result.scopes.map(scope => <li key={scope}><code>{scope}</code></li>)}</ul>
        <p className="mt-3 text-sm text-amber-200">{result.note}</p>
      </div> :
      <p role="status" className="mt-3 text-sm text-amber-300">Scope inspection unavailable: {result.code}. Do not infer permissions or enable shipping requests.</p>)}
  </section>
}
