import { toRazorpaySubunits } from './razorpay-money.ts'

const ID = /^order_[A-Za-z0-9]{8,64}$/
const RECEIPT = /^evs_[0-9a-f]{32}$/
export type StoreProviderOrderExpectation = {
  providerOrderId: string
  receipt: string
  amount: string
  currency: string
}
export type StoreProviderOrderEvidence = {
  id: string
  receipt: string
  amount: number
  currency: string
}

export function verifyStoreProviderOrderEvidence(
  expected: StoreProviderOrderExpectation,
  actual: unknown,
): StoreProviderOrderEvidence {
  if (!ID.test(expected.providerOrderId) || !RECEIPT.test(expected.receipt)) {
    throw new Error('STORE_PROVIDER_EXPECTATION_INVALID')
  }
  const expectedSubunits = toRazorpaySubunits(expected.amount, expected.currency)
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    throw new Error('STORE_PROVIDER_RESPONSE_INVALID')
  }
  const order = actual as Record<string, unknown>
  if (order.id !== expected.providerOrderId
    || order.receipt !== expected.receipt
    || order.currency !== expected.currency
    || !Number.isSafeInteger(order.amount)
    || order.amount !== expectedSubunits) {
    throw new Error('STORE_PROVIDER_EVIDENCE_MISMATCH')
  }
  return {
    id: expected.providerOrderId,
    receipt: expected.receipt,
    amount: expectedSubunits,
    currency: expected.currency,
  }
}
