'use client'

import { useState } from 'react'

type Destination = 'IN' | 'US'
const examples = {
  IN: { label: 'India', recipient: { country_code: 'IN' }, note: 'Country-only data is insufficient for a dependable customer checkout quote. City and postal code should be collected.' },
  US: { label: 'United States', recipient: { country_code: 'US', state_code: 'CA' }, note: 'Printful requires state_code for US shipping estimates. CA is an illustrative state only, not a real customer destination.' },
} as const

export function ShippingReadinessControl() {
  const [destination, setDestination] = useState<Destination>('IN')
  const selected = examples[destination]
  return <section className="mt-8 border border-amber-400/30 p-5 sm:p-7" aria-labelledby="shipping-readiness-heading">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Shipping design checkpoint</p>
    <h2 id="shipping-readiness-heading" className="mt-2 text-xl font-semibold">Shipping readiness — not a live quote</h2>
    <p className="mt-2 text-sm text-zinc-400">Preview the required recipient details for the two initial markets. This panel does not contact the shipping-rates endpoint, produce a shipping rate, save customer addresses, or create an order.</p>
    <label htmlFor="shipping-readiness-destination" className="mt-4 block text-sm font-medium">Destination example</label>
    <select id="shipping-readiness-destination" value={destination} onChange={e => setDestination(e.target.value === 'US' ? 'US' : 'IN')} className="mt-2 w-full max-w-sm border border-white/30 bg-black p-3">
      <option value="IN">India</option><option value="US">United States</option>
    </select>
    <div className="mt-4 space-y-2 text-sm">
      <p><strong>{selected.label} recipient requirements:</strong> {selected.note}</p>
      <pre className="overflow-x-auto border border-white/10 p-3 text-zinc-300">{JSON.stringify(selected.recipient, null, 2)}</pre>
      <p className="text-amber-200">Required before live checkout: customer address, selected variant and quantity, an explicitly verified currency, Printful store shipping configuration, taxes and possible customs charges.</p>
      <p className="text-zinc-400">Printful calculates dynamic shipping rates immediately before checkout via POST /shipping/rates (or its v2 equivalent). This endpoint is a non-order quote request, but the present read-only product/file token has not been verified for that scope. No quote requests are enabled.</p>
      <p className="text-zinc-400">Provider guidance: <a href="https://developers.printful.com/docs/" target="_blank" rel="noreferrer" className="text-amber-300 underline">Printful Shipping Rate API documentation</a>.</p>
    </div>
  </section>
}
