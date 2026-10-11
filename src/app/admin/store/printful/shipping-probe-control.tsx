'use client'

import { useState } from 'react'
import { inspectShippingProbe } from './actions'
import type { ShippingProbeResult } from '@/lib/printful/shipping-probe'

export function ShippingProbeControl({ enabled }: { enabled: boolean }) {
  const [country, setCountry] = useState<'IN' | 'US'>('IN')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<ShippingProbeResult | null>(null)

  async function run() {
    if (!enabled || pending || !window.confirm('Send ONE non-order shipping-rate request to Printful for the approved Black / S variant (quantity 1)? No orders are created.')) return
    setPending(true)
    setResult(null)
    try { setResult(await inspectShippingProbe(country)) }
    catch { setResult({ ok: false, code: 'UNAVAILABLE' }) }
    finally { setPending(false) }
  }
  return <section className="mt-8 border border-amber-400/30 p-5 sm:p-7" aria-labelledby="shipping-probe-heading">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Independently gated</p>
    <h2 id="shipping-probe-heading" className="mt-2 text-xl font-semibold">Single shipping-rate authorization probe</h2>
    <p className="mt-2 text-sm text-zinc-400">Uses one approved Black / S catalog variant (quantity 1) and an illustrative country/state destination. No customer address is transmitted, no prices or inventory are stored, and no fulfillment order is created.</p>
    {!enabled ? <p className="mt-3 text-sm text-amber-300">Probe locked. Separate server-side authorization is OFF.</p> : <>
      <label htmlFor="shipping-probe-country" className="mt-4 block text-sm">Illustrative destination</label>
      <select id="shipping-probe-country" className="mt-2 border border-white/30 bg-black p-3" value={country} onChange={e => setCountry(e.target.value === 'US' ? 'US' : 'IN')}>
        <option value="IN">India (IN)</option><option value="US">United States (CA)</option>
      </select>
      <div><button type="button" disabled={pending} onClick={run} className="mt-4 border border-amber-300 px-4 py-3 font-semibold text-amber-200 disabled:opacity-50">{pending ? 'Checking quote…' : 'Request one illustrative quote'}</button></div>
      {result && (result.ok ?
        <div role="status" className="mt-4"><p className="text-sm text-emerald-300">Shipping quote endpoint returned {result.options.length} options.</p>
          <p className="mt-2 text-sm text-amber-200">{result.note}</p>
          <ul className="mt-3 space-y-1 text-sm">{result.options.map(option => <li key={option.id}>{option.name} — {option.rate} {option.currency}</li>)}</ul>
        </div> : <p role="status" className="mt-4 text-sm text-amber-300">Probe did not produce an authorized quote: {result.code}. Do not expand token permissions without review.</p>)}
    </>}
  </section>
}
