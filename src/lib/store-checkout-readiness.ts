import type { ResolvedStoreCartLine, StoreCartSummary } from './store-cart-resolver'

/** Advisory only. An authoritative, atomic inventory reservation must still run at order creation. */
export function assessStoreCheckoutReadiness(
  lines: ResolvedStoreCartLine[],
  summary: StoreCartSummary,
): { readyForOrderAttempt: boolean; blockers: string[] } {
  const blockers: string[] = []
  if (!lines.length || !summary.lineCount) blockers.push('cart_empty')
  if (!summary.allLinesEligible || summary.hasUnavailableLines ||
      lines.some((line) => !line.isEligible || !line.price || !line.product || !line.lineTotal))
    blockers.push('unavailable_lines')
  if (lines.some((line) => line.price?.currency !== summary.currency))
    blockers.push('currency_mismatch')
  if (lines.length !== summary.lineCount ||
      lines.reduce((sum, line) => sum + line.quantity, 0) !== summary.itemCount)
    blockers.push('cart_summary_mismatch')
  if (lines.some((line) => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10))
    blockers.push('invalid_quantity')
  return {readyForOrderAttempt:blockers.length === 0,blockers}
}
