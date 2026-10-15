import 'server-only'
import { verifyStoreProviderOrderEvidence, type StoreProviderOrderExpectation } from './store-razorpay-provider-evidence'

const PROVIDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const BASE = 'https://api.razorpay.com/v1/orders/'

/**
 * Read-only verifier. Call only from a separately authorized internal operator path.
 * This file does not dispatch, correlate, confirm payment, or write to Supabase.
 * The expectation MUST come from trusted persisted Store rows, never request input.
 */
export async function fetchVerifiedStoreProviderOrder(expected: StoreProviderOrderExpectation) {
  if (!PROVIDER_ID.test(expected.providerOrderId)) throw new Error('STORE_PROVIDER_ID_INVALID')
  const keyId = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !secret) throw new Error('STORE_PROVIDER_CREDENTIALS_MISSING')
  const response = await fetch(BASE + encodeURIComponent(expected.providerOrderId), {
    method: 'GET',
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('STORE_PROVIDER_READ_FAILED')
  let body: unknown
  try { body = await response.json() } catch { throw new Error('STORE_PROVIDER_RESPONSE_INVALID') }
  return verifyStoreProviderOrderEvidence(expected, body)
}
