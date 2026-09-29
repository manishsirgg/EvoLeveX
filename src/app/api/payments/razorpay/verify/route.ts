import { NextRequest, NextResponse } from 'next/server'

import { verifyRazorpayCheckoutSignature } from '@/lib/razorpay'
import { parseRazorpayCheckoutCallback } from '@/lib/razorpay-checkout-callback'
import { createClient } from '@/lib/supabase/server'
import { isSameOrigin } from '@/lib/view-tracking'

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

  const value = parseRazorpayCheckoutCallback(body)
  if (!value) return json({ error: 'Invalid request body' }, 400)

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Authentication required' }, 401)

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('provider_order_id')
    .eq('id', value.paymentId)
    .eq('provider', 'razorpay')
    .maybeSingle()

  if (paymentError || !payment) return json({ error: 'Payment is unavailable' }, 404)
  if (!payment.provider_order_id || payment.provider_order_id !== value.razorpayOrderId) {
    return json({ error: 'Payment provider reconciliation is required' }, 409)
  }

  let signatureIsValid: boolean
  try {
    signatureIsValid = verifyRazorpayCheckoutSignature(
      payment.provider_order_id,
      value.razorpayPaymentId,
      value.razorpaySignature,
    )
  } catch {
    return json({ error: 'Unable to verify payment' }, 500)
  }
  if (!signatureIsValid) return json({ error: 'Payment verification failed' }, 400)

  const { data, error } = await supabase.rpc('confirm_razorpay_payment', {
    p_payment_id: value.paymentId,
    p_provider_order_id: payment.provider_order_id,
    p_provider_payment_id: value.razorpayPaymentId,
  })
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
