import { verifyStoreProviderOrderEvidence, type StoreProviderOrderEvidence } from './store-razorpay-provider-evidence.ts'
import { toRazorpaySubunits } from './razorpay-money.ts'

export type UncertainStoreOrderExpectation = Readonly<{
  receipt: string
  amount: string
  currency: string
}>

const RECEIPT = /^evs_[0-9a-f]{32}$/
const ID = /^order_[A-Za-z0-9]{8,64}$/

/**
 * Pure, closed validation boundary for operator-reviewed Razorpay list evidence.
 * Do not supply provider records, receipt, or values from customer request input.
 * Evidence discovery is NOT payment verification or correlation authorization.
 * A missing/ambiguous result remains locked for manual reconciliation.
 */
export function identifyUniqueStoreProviderOrder(
  expected: UncertainStoreOrderExpectation,
  rawPages: readonly unknown[],
): StoreProviderOrderEvidence {
  if (!RECEIPT.test(expected.receipt)) throw new Error('STORE_PROVIDER_RECEIPT_INVALID')
  const amount = toRazorpaySubunits(expected.amount, expected.currency)
  if (rawPages.length === 0 || rawPages.length > 10) throw new Error('STORE_PROVIDER_DISCOVERY_INCOMPLETE')
  const matches: StoreProviderOrderEvidence[] = []
  const ids = new Set<string>()
  for (const raw of rawPages) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('STORE_PROVIDER_DISCOVERY_RESPONSE_INVALID')
    }
    const page = raw as Record<string, unknown>
    if (page.entity !== 'collection' || !Array.isArray(page.items)
      || page.items.length > 100 || !Number.isSafeInteger(page.count)
      || (page.count as number) !== page.items.length) {
      throw new Error('STORE_PROVIDER_DISCOVERY_RESPONSE_INVALID')
    }
    for (const item of page.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error('STORE_PROVIDER_DISCOVERY_RESPONSE_INVALID')
      }
      const order = item as Record<string, unknown>
      if (order.receipt !== expected.receipt) continue
      if (typeof order.id !== 'string' || !ID.test(order.id)) {
        throw new Error('STORE_PROVIDER_DISCOVERY_MATCH_INVALID')
      }
      if (ids.has(order.id)) continue
      ids.add(order.id)
      matches.push(verifyStoreProviderOrderEvidence({
        providerOrderId: order.id, receipt: expected.receipt,
        amount: expected.amount, currency: expected.currency,
      }, order))
    }
  }
  if (matches.length === 0) throw new Error('STORE_PROVIDER_DISCOVERY_NOT_FOUND')
  if (matches.length !== 1) throw new Error('STORE_PROVIDER_DISCOVERY_AMBIGUOUS')
  if (matches[0].amount !== amount) throw new Error('STORE_PROVIDER_DISCOVERY_AMOUNT_MISMATCH')
  return matches[0]
}
