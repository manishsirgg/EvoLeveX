'use client'

import { useState } from 'react'
import { calculateIllustrativeLandedCost, type WorksheetInputs } from '@/lib/printful/landed-cost-worksheet'

const fields: { key: keyof WorksheetInputs; label: string; guidance: string }[] = [
  { key: 'catalogObservation', label: 'Catalog price observation', guidance: 'Provider amount, not proven decorated-production cost' },
  { key: 'printingExtra', label: 'Verified printing / decoration extra', guidance: 'Do not assume this is zero' },
  { key: 'shippingEstimate', label: 'Shipping estimate', guidance: 'India Black/S historical observation: 12.49 USD; not a live quote' },
  { key: 'taxesAndDuties', label: 'Taxes and import duties', guidance: 'Do not assume zero without a verified basis' },
  { key: 'paymentFees', label: 'Payment processing fees', guidance: 'Estimate only; merchant processor fee not verified' },
  { key: 'otherCosts', label: 'Other cost allowances', guidance: 'Include packaging, refunds and contingencies as applicable' },
  { key: 'targetProfit', label: 'Target profit amount', guidance: 'Absolute amount, not a percentage margin' },
]
const initial = Object.fromEntries(fields.map(field => [field.key, ''])) as WorksheetInputs

export function LandedCostWorksheetControl() {
  const [inputs, setInputs] = useState<WorksheetInputs>(initial)
  const [currencyConfirmed, setCurrencyConfirmed] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const result = calculateIllustrativeLandedCost(inputs, currencyConfirmed && acknowledged)
  return <section className="mt-8 border border-amber-400/30 p-5 sm:p-7" aria-labelledby="landed-cost-heading">
    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Printful · Offline financial worksheet</p>
    <h2 id="landed-cost-heading" className="mt-2 text-xl font-semibold">Landed-cost assessment (illustrative only)</h2>
    <p className="mt-2 text-sm text-zinc-400">Manual worksheet for the existing T-shirt variants. Enter figures yourself; this calculator makes no API calls, changes no inventory or database records and never sets selling prices. All fields are required; unknown fees must remain unresolved rather than silently becoming zero.</p>
    <p className="mt-3 text-sm text-amber-200">Observed historical catalog prices: S–XL 16.91, 2XL 18.91, 3XL 20.91 (catalog response did not supply currency). One India Black/S shipping observation: 12.49 USD flat or 12.58 USD with CO₂ offsetting. These figures have different levels of currency evidence and are not automatically added together.</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">{fields.map(field => <div key={field.key}>
      <label htmlFor={`landed-${field.key}`} className="block text-sm font-medium">{field.label}</label>
      <p className="mt-1 text-xs text-zinc-400">{field.guidance}</p>
      <input id={`landed-${field.key}`} type="text" inputMode="decimal" placeholder="Required amount" value={inputs[field.key]} onChange={event => setInputs(current => ({ ...current, [field.key]: event.target.value }))} className="mt-2 w-full border border-white/30 bg-black p-3" />
    </div>)}</div>
    <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" checked={currencyConfirmed} onChange={event => setCurrencyConfirmed(event.target.checked)} />I independently verified that every entered amount uses the same specified currency. The provider catalog observation has no currency field, so it needs independent confirmation.</label>
    <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I have entered documented or explicitly estimated values for every cost category, including allowances, and understand this does not authorize retail pricing or publication.</label>
    {result.ok ? <div role="status" className="mt-4 border-t border-white/20 pt-4 text-sm">
      <p>Illustrative total cost: <strong>{result.totalCost}</strong></p>
      <p>Target profit amount: <strong>{result.profit}</strong></p>
      <p>Illustrative cost-plus target: <strong>{result.illustrativePrice}</strong></p>
      <p className="mt-2 text-amber-200">All outputs use the one currency you independently verified. Costs, tax treatment, exchange rates, and provider fulfillment charges may change. Not a retail quote, checkout price or database record.</p>
    </div> : <p role="status" className="mt-4 text-sm text-amber-300">Calculation withheld: {result.reason === 'CURRENCY_NOT_VERIFIED' ? 'verify a common currency and acknowledge the data limitations first.' : 'enter every required nonnegative amount in decimal format.'}</p>}
  </section>
}
