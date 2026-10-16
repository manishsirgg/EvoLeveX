import 'server-only'
import { discoverStoreOrderFromReceiptPages } from './store-razorpay-receipt-pages'
import type { UncertainStoreOrderExpectation } from './store-razorpay-uncertain-discovery'
import type { StoreProviderOrderEvidence } from './store-razorpay-provider-evidence'

const RECEIPT = /^evs_[0-9a-f]{32}$/
const BASE = 'https://api.razorpay.com/v1/orders'

/**
 * Closed operator-side Razorpay read-only receipt lookup.
 * NEVER invoke with request-supplied expectations. A future caller must load
 * all fields from an audited, administrator-authorized uncertain-attempt RPC.
 * Does not create/correlate orders, confirm payment, or release fulfillment.
 */
export async function fetchUniqueStoreOrderByTrustedReceipt(
  expected: UncertainStoreOrderExpectation,
): Promise<StoreProviderOrderEvidence> {
  if (!RECEIPT.test(expected.receipt)) throw new Error('STORE_PROVIDER_RECEIPT_INVALID')
  const keyId = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !secret) throw new Error('STORE_PROVIDER_CREDENTIALS_MISSING')

  return discoverStoreOrderFromReceiptPages(expected, async (skip, count) => {
    const url = new URL(BASE)
    url.searchParams.set('receipt', expected.receipt)
    url.searchParams.set('skip', String(skip))
    url.searchParams.set('count', String(count))
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error('STORE_PROVIDER_DISCOVERY_READ_FAILED')
    try { return await response.json() }
    catch { throw new Error('STORE_PROVIDER_DISCOVERY_RESPONSE_INVALID') }
  })
}
