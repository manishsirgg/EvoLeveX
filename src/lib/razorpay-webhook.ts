import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { toRazorpaySubunits } from './razorpay-money.ts'

const SIGNATURE = /^[a-fA-F0-9]{64}$/
const PAYMENT_ID = /^pay_[A-Za-z0-9]{8,64}$/
const ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const EVENT_ID = /^[\x21-\x7e]{1,255}$/
const SUCCESS_EVENTS = new Set(['payment.captured', 'order.paid'])

export type ExtractedWebhook = {
  eventType: string
  providerPaymentId: string | null
  providerOrderId: string | null
  supported: boolean
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string | null, secret: string) {
  if (!secret || !signature || !SIGNATURE.test(signature)) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  const supplied = Buffer.from(signature, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function validateRazorpayEventId(value: string | null) {
  return value !== null && EVENT_ID.test(value)
}

export function webhookPayloadSha256(rawBody: Buffer) {
  return createHash('sha256').update(rawBody).digest('hex')
}

export function extractRazorpayWebhook(payload: unknown): ExtractedWebhook {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid webhook envelope')
  }
  const envelope = payload as Record<string, unknown>
  if (typeof envelope.event !== 'string' || !envelope.event.trim()) {
    throw new Error('Invalid webhook event')
  }
  const eventType = envelope.event
  if (!SUCCESS_EVENTS.has(eventType)) {
    return { eventType, providerPaymentId: null, providerOrderId: null, supported: false }
  }

  const root = envelope.payload
  const payment = root && typeof root === 'object' && !Array.isArray(root)
    ? (root as Record<string, unknown>).payment : null
  const entity = payment && typeof payment === 'object' && !Array.isArray(payment)
    ? (payment as Record<string, unknown>).entity : null
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
    throw new Error('Missing payment entity')
  }
  const value = entity as Record<string, unknown>
  const providerPaymentId = typeof value.id === 'string' ? value.id : ''
  const providerOrderId = typeof value.order_id === 'string' ? value.order_id : ''
  if (!PAYMENT_ID.test(providerPaymentId) || !ORDER_ID.test(providerOrderId)) {
    throw new Error('Invalid provider identifiers')
  }
  return { eventType, providerPaymentId, providerOrderId, supported: true }
}

type CanonicalPayment = {
  id: string
  order_id: string
  amount: number
  currency: string
  status: string
  captured: boolean
}

export function validateCanonicalRazorpayPayment(
  canonical: CanonicalPayment,
  expected: { paymentId: string; orderId: string; amount: string; currency: string },
) {
  if (canonical.id !== expected.paymentId) throw new Error('provider_payment_id_mismatch')
  if (canonical.order_id !== expected.orderId) throw new Error('provider_order_id_mismatch')
  if (canonical.status !== 'captured') throw new Error('payment_not_captured')
  if (canonical.captured !== true) throw new Error('captured_flag_false')
  if (canonical.currency !== expected.currency) throw new Error('currency_mismatch')
  if (canonical.amount !== toRazorpaySubunits(expected.amount, expected.currency)) {
    throw new Error('amount_mismatch')
  }
}

export function safeWebhookErrorCode(error: unknown) {
  if (error instanceof Error && /^[a-z][a-z0-9_]{0,63}$/.test(error.message)) return error.message
  return 'webhook_processing_failed'
}
