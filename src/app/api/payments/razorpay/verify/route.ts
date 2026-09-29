import { NextRequest, NextResponse } from 'next/server'

import { confirmCanonicalRazorpayPayment } from '@/lib/razorpay-browser-confirmation'
import {
  fetchRazorpayPayment,
  RazorpayRequestError,
  verifyRazorpayCheckoutSignature,
} from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { isSameOrigin } from '@/lib/view-tracking'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDER_ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const PROVIDER_PAYMENT_ID = /^pay_[A-Za-z0-9]{8,64}$/
const CHECKOUT_SIGNATURE = /^[a-fA-F0-9]{64}$/
const BODY_KEYS = ['paymentId', 'razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature'].sort()

type Confirmation = {
  payment_id: string
  order_id: string
  provider_order_id: string
  provider_payment_id: string
  payment_status: string
  order_status: string
}

function json(body: object, status = 200) {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: 'Invalid request origin' }, 403)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Invalid request body' }, 400)
  }

  const value = body as Record<string, unknown>
  const keys = Object.keys(value).sort()
  if (keys.length !== BODY_KEYS.length || keys.some((key, index) => key !== BODY_KEYS[index])
    || typeof value.paymentId !== 'string' || !UUID.test(value.paymentId)
    || typeof value.razorpayOrderId !== 'string' || !PROVIDER_ORDER_ID.test(value.razorpayOrderId)
    || typeof value.razorpayPaymentId !== 'string' || !PROVIDER_PAYMENT_ID.test(value.razorpayPaymentId)
    || typeof value.razorpaySignature !== 'string' || !CHECKOUT_SIGNATURE.test(value.razorpaySignature)) {
    return json({ error: 'Invalid request body' }, 400)
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Authentication required' }, 401)

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('provider_order_id, amount, currency')
    .eq('id', value.paymentId)
    .eq('provider', 'razorpay')
    .maybeSingle()

  if (paymentError || !payment) return json({ error: 'Payment is unavailable' }, 404)
  if (!payment.provider_order_id || payment.provider_order_id !== value.razorpayOrderId) {
    return json({ error: 'Payment provider reconciliation is required' }, 409)
  }

  const result = await confirmCanonicalRazorpayPayment({
    paymentId: value.razorpayPaymentId,
    orderId: payment.provider_order_id,
    amount: String(payment.amount),
    currency: payment.currency,
  }, {
    verifyCheckoutSignature: () => verifyRazorpayCheckoutSignature(
      payment.provider_order_id,
      value.razorpayPaymentId,
      value.razorpaySignature,
    ),
    fetchPayment: fetchRazorpayPayment,
    isRetryableFetchError: (error) => error instanceof RazorpayRequestError && error.ambiguous,
    confirmPayment: async () => supabase.rpc('confirm_razorpay_payment', {
      p_payment_id: value.paymentId,
      p_provider_order_id: payment.provider_order_id,
      p_provider_payment_id: value.razorpayPaymentId,
    }),
  })

  if (result.outcome === 'verification_unavailable') {
    return json({ error: 'Unable to verify payment' }, 500)
  }
  if (result.outcome === 'invalid_signature') {
    return json({ error: 'Payment verification failed' }, 400)
  }
  if (result.outcome === 'provider_unavailable') {
    return result.retryable
      ? json({ error: 'Payment verification is temporarily unavailable' }, 503)
      : json({ error: 'Payment verification is incomplete' }, 409)
  }
  if (result.outcome === 'incomplete') {
    return json({ error: 'Payment verification is incomplete' }, 409)
  }

  const { data, error } = result.confirmation
  if (error) return json({ error: 'Payment provider reconciliation is required' }, 409)

  const confirmation = (Array.isArray(data) ? data[0] : data) as Confirmation | null
  if (!confirmation
    || confirmation.payment_id !== value.paymentId
    || confirmation.provider_order_id !== payment.provider_order_id
    || confirmation.provider_payment_id !== value.razorpayPaymentId
    || confirmation.payment_status !== 'paid'
    || confirmation.order_status !== 'confirmed') {
    return json({ error: 'Payment provider reconciliation is required' }, 409)
  }

  return json({
    paymentId: confirmation.payment_id,
    orderId: confirmation.order_id,
    providerPaymentId: confirmation.provider_payment_id,
    paymentStatus: confirmation.payment_status,
    orderStatus: confirmation.order_status,
  })
}
