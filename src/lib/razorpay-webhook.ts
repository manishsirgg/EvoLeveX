import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { toRazorpaySubunits } from './razorpay-money.ts'

const SIGNATURE = /^[a-fA-F0-9]{64}$/
const PAYMENT_ID = /^pay_[A-Za-z0-9]{8,64}$/
const ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const REFUND_ID = /^rfnd_[A-Za-z0-9]{8,64}$/
const EVENT_ID = /^[\x21-\x7e]{1,255}$/
const PAYMENT_SUCCESS_EVENTS = new Set(['payment.captured', 'order.paid'])
const REFUND_EVENT = 'refund.processed'

export type ExtractedWebhook = {
  eventType: string
  providerPaymentId: string | null
  providerOrderId: string | null
  providerRefundId: string | null
  refundAmount: number | null
  refundCurrency: string | null
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
  if (!PAYMENT_SUCCESS_EVENTS.has(eventType) && eventType !== REFUND_EVENT) {
    return { eventType, providerPaymentId: null, providerOrderId: null, providerRefundId: null,
      refundAmount: null, refundCurrency: null, supported: false }
  }

  const root = envelope.payload
  if (eventType === REFUND_EVENT) {
    const refund = root && typeof root === 'object' && !Array.isArray(root)
      ? (root as Record<string, unknown>).refund : null
    const refundEntity = refund && typeof refund === 'object' && !Array.isArray(refund)
      ? (refund as Record<string, unknown>).entity : null
    if (!refundEntity || typeof refundEntity !== 'object' || Array.isArray(refundEntity)) {
      throw new Error('Missing refund entity')
    }
    const value = refundEntity as Record<string, unknown>
    const providerRefundId = typeof value.id === 'string' ? value.id : ''
    const providerPaymentId = typeof value.payment_id === 'string' ? value.payment_id : ''
    const refundAmount = value.amount
    const refundCurrency = value.currency
    if (!REFUND_ID.test(providerRefundId) || !PAYMENT_ID.test(providerPaymentId)
      || typeof refundAmount !== 'number' || !Number.isSafeInteger(refundAmount) || refundAmount <= 0
      || typeof refundCurrency !== 'string' || !refundCurrency) {
      throw new Error('Invalid refund entity')
    }
    return { eventType, providerPaymentId, providerOrderId: null, providerRefundId,
      refundAmount, refundCurrency, supported: true }
  }
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
  return { eventType, providerPaymentId, providerOrderId, providerRefundId: null,
    refundAmount: null, refundCurrency: null, supported: true }
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


type CanonicalRefund = {
  id: string
  payment_id: string
  amount: number
  currency: string
  status: string
  created_at: number
}

export function validateCanonicalRazorpayRefund(
  canonical: CanonicalRefund,
  parent: CanonicalPayment,
  expected: { refundId: string; paymentId: string; webhookAmount: number;
    webhookCurrency: string; paymentAmount: string; paymentCurrency: string; refundedAmount: string },
) {
  if (canonical.id !== expected.refundId) throw new Error('provider_refund_id_mismatch')
  if (canonical.payment_id !== expected.paymentId) throw new Error('parent_payment_mismatch')
  if (canonical.status !== 'processed') throw new Error('refund_not_processed')
  if (canonical.amount !== expected.webhookAmount) throw new Error('refund_amount_mismatch')
  if (canonical.currency !== expected.webhookCurrency) throw new Error('refund_currency_mismatch')
  if (parent.id !== expected.paymentId || parent.id !== canonical.payment_id) {
    throw new Error('parent_payment_mismatch')
  }
  if (parent.status !== 'captured' || parent.captured !== true) throw new Error('payment_not_captured')
  if (parent.currency !== expected.paymentCurrency || canonical.currency !== expected.paymentCurrency) {
    throw new Error('currency_mismatch')
  }
  const capturedAmount = toRazorpaySubunits(expected.paymentAmount, expected.paymentCurrency)
  if (parent.amount !== capturedAmount) throw new Error('amount_mismatch')
  const previouslyRefunded = expected.refundedAmount === '0'
    ? 0 : toRazorpaySubunits(expected.refundedAmount, expected.paymentCurrency)
  if (previouslyRefunded > parent.amount
    || canonical.amount > parent.amount - previouslyRefunded) throw new Error('refund_exceeds_payment')
  if (!Number.isSafeInteger(canonical.created_at) || canonical.created_at <= 0) {
    throw new Error('invalid_refund_timestamp')
  }
}
