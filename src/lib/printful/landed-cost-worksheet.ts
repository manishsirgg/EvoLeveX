// Informational arithmetic only: never a charge, checkout amount or authoritative selling price.
export type WorksheetInputs = {
  catalogObservation: string
  printingExtra: string
  shippingEstimate: string
  taxesAndDuties: string
  paymentFees: string
  otherCosts: string
  targetProfit: string
}
export type WorksheetResult =
  | { ok: true; totalCost: string; illustrativePrice: string; profit: string }
  | { ok: false; reason: 'MISSING_OR_INVALID_INPUT' | 'CURRENCY_NOT_VERIFIED' }

function parseMoney(s: string): number | null {
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(s)) return null
  const cents = Math.round(Number(s) * 100)
  return Number.isSafeInteger(cents) ? cents : null
}
function money(cents: number): string { return (cents / 100).toFixed(2) }
export function calculateIllustrativeLandedCost(inputs: WorksheetInputs, currencyVerified: boolean): WorksheetResult {
  if (!currencyVerified) return { ok: false, reason: 'CURRENCY_NOT_VERIFIED' }
  const values = [
    inputs.catalogObservation, inputs.printingExtra, inputs.shippingEstimate,
    inputs.taxesAndDuties, inputs.paymentFees, inputs.otherCosts, inputs.targetProfit,
  ].map(parseMoney)
  if (values.some(v => v === null)) return { ok: false, reason: 'MISSING_OR_INVALID_INPUT' }
  const [catalog, print, shipping, taxes, fees, others, profit] = values as number[]
  const total = catalog + print + shipping + taxes + fees + others
  return { ok: true, totalCost: money(total), illustrativePrice: money(total + profit), profit: money(profit) }
}
