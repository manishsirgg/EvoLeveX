import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import type { SupportedCurrency } from '@/lib/currency'
export { toRazorpaySubunits } from '@/lib/razorpay-money'

const ORDER_ENDPOINT = 'https://api.razorpay.com/v1/orders'
const PAYMENT_ENDPOINT = 'https://api.razorpay.com/v1/payments'
const REQUEST_TIMEOUT_MS = 10_000
const PROVIDER_ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const PROVIDER_PAYMENT_ID = /^pay_[A-Za-z0-9]{8,64}$/
const CHECKOUT_SIGNATURE = /^[a-fA-F0-9]{64}$/

export class RazorpayRequestError extends Error {
  constructor(public readonly ambiguous: boolean) {
    super(ambiguous ? 'Razorpay request outcome is ambiguous' : 'Razorpay rejected the order')
    this.name = 'RazorpayRequestError'
  }
}

export type RazorpayPayment = {
  id: string
  order_id: string
  amount: number
  currency: string
  status: string
  captured: boolean
}

export function razorpayReceipt(paymentId: string) {
  // "evx_" plus a UUID is exactly Razorpay's 40-character receipt limit.
  return `evx_${paymentId}`
}

export function verifyRazorpayCheckoutSignature(
  storedProviderOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) {
  if (!PROVIDER_ORDER_ID.test(storedProviderOrderId)
    || !PROVIDER_PAYMENT_ID.test(razorpayPaymentId)
    || !CHECKOUT_SIGNATURE.test(razorpaySignature)) {
    return false
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) throw new Error('Razorpay is not configured')

  const expected = createHmac('sha256', keySecret)
    .update(`${storedProviderOrderId}|${razorpayPaymentId}`, 'utf8')
    .digest()
  const supplied = Buffer.from(razorpaySignature, 'hex')

  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

type CreateOrderInput = {
  amount: number
  currency: SupportedCurrency
  receipt: string
  orderId: string
  paymentId: string
}

export async function createRazorpayOrder(input: CreateOrderInput) {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new RazorpayRequestError(false)

  let response: Response
  try {
    response = await fetch(ORDER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: { local_order_id: input.orderId, local_payment_id: input.paymentId },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    // A transport failure may have happened after Razorpay accepted the order; never retry here.
    throw new RazorpayRequestError(true)
  }

  if (!response.ok) throw new RazorpayRequestError(false)

  let value: unknown
  try {
    value = await response.json()
  } catch {
    // Razorpay accepted the request, but the response cannot be reconciled safely.
    throw new RazorpayRequestError(true)
  }
  if (!value || typeof value !== 'object') throw new RazorpayRequestError(true)

  const order = value as Record<string, unknown>
  if (!PROVIDER_ORDER_ID.test(String(order.id ?? ''))
    || order.amount !== input.amount
    || order.currency !== input.currency
    || order.receipt !== input.receipt) {
    throw new RazorpayRequestError(true)
  }

  return { id: order.id as string }
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!PROVIDER_PAYMENT_ID.test(paymentId)) throw new RazorpayRequestError(false)
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new RazorpayRequestError(true)

  let response: Response
  try {
    response = await fetch(`${PAYMENT_ENDPOINT}/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new RazorpayRequestError(true)
  }
  if (!response.ok) throw new RazorpayRequestError(response.status >= 500 || response.status === 429)

  let value: unknown
  try {
    value = await response.json()
  } catch {
    throw new RazorpayRequestError(true)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RazorpayRequestError(true)
  }
  const payment = value as Record<string, unknown>
  if (typeof payment.id !== 'string' || typeof payment.order_id !== 'string'
    || typeof payment.amount !== 'number' || !Number.isSafeInteger(payment.amount)
    || typeof payment.currency !== 'string' || typeof payment.status !== 'string'
    || typeof payment.captured !== 'boolean') {
    throw new RazorpayRequestError(true)
  }
  return payment as RazorpayPayment
}
