import { identifyUniqueStoreProviderOrder, type UncertainStoreOrderExpectation } from './store-razorpay-uncertain-discovery.ts'
import type { StoreProviderOrderEvidence } from './store-razorpay-provider-evidence.ts'

const PAGE_SIZE = 100
const MAX_PAGES = 10

/** Pure pagination coordinator; caller must supply only trusted DB expectations. */
export async function discoverStoreOrderFromReceiptPages(
  expected: UncertainStoreOrderExpectation,
  fetchPage: (skip: number, count: number) => Promise<unknown>,
): Promise<StoreProviderOrderEvidence> {
  const pages: unknown[] = []
  for (let index = 0; index < MAX_PAGES; index++) {
    const page = await fetchPage(index * PAGE_SIZE, PAGE_SIZE)
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      throw new Error('STORE_PROVIDER_DISCOVERY_RESPONSE_INVALID')
    }
    const body = page as Record<string, unknown>
    if (body.entity !== 'collection' || !Array.isArray(body.items)
      || body.items.length > PAGE_SIZE || body.count !== body.items.length) {
      throw new Error('STORE_PROVIDER_DISCOVERY_RESPONSE_INVALID')
    }
    pages.push(page)
    // A short page completes the receipt-filtered collection.
    if (body.items.length < PAGE_SIZE) return identifyUniqueStoreProviderOrder(expected, pages)
  }
  // Never use the first matching order when a complete scan is not established.
  throw new Error('STORE_PROVIDER_DISCOVERY_INCOMPLETE')
}
