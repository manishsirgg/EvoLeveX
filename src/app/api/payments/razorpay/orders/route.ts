import { NextRequest, NextResponse } from 'next/server'

import {
  createRazorpayOrder,
  razorpayReceipt,
  RazorpayRequestError,
  SupportedCurrency,
  toRazorpaySubunits,
} from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { isSameOrigin } from '@/lib/view-tracking'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Reservation = {
  payment_id: string
  order_id: string
  amount: number | string
  currency: string
  provider_order_id: string | null
  created: boolean
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

  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || !('orderId' in body)
    || typeof body.orderId !== 'string' || !UUID.test(body.orderId)) {
    return json({ error: 'Invalid request body' }, 400)
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Authentication required' }, 401)

  const { data, error } = await supabase.rpc('reserve_razorpay_payment', { p_order_id: body.orderId })
  if (error) return json({ error: 'Unable to prepare payment' }, 409)

  const reservation = (Array.isArray(data) ? data[0] : data) as Reservation | null
  if (!reservation || !UUID.test(reservation.payment_id) || reservation.order_id !== body.orderId) {
    return json({ error: 'Unable to prepare payment' }, 500)
  }

  let amount: number
  let currency: SupportedCurrency
  try {
    currency = reservation.currency as SupportedCurrency
    amount = toRazorpaySubunits(String(reservation.amount), currency)
  } catch {
    return json({ error: 'Unable to prepare payment' }, 500)
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  if (!keyId) return json({ error: 'Unable to prepare payment' }, 500)

  if (reservation.provider_order_id) {
    return json({ orderId: reservation.order_id, paymentId: reservation.payment_id,
      providerOrderId: reservation.provider_order_id, amount, currency, keyId })
  }

  // The reservation transaction has ended, so its advisory lock cannot span this HTTP request.
  // A provider-side duplicate race remains possible and requires separate reconciliation.
  let providerOrder: { id: string }
  try {
    providerOrder = await createRazorpayOrder({
      amount,
      currency,
      receipt: razorpayReceipt(reservation.payment_id),
      orderId: reservation.order_id,
      paymentId: reservation.payment_id,
    })
  } catch (error) {
    if (error instanceof RazorpayRequestError && error.ambiguous) {
      return json({ error: 'Payment provider reconciliation is required' }, 503)
    }
    return json({ error: 'Unable to create provider order' }, 502)
  }

  const { data: attachedData, error: attachError } = await supabase.rpc('attach_razorpay_order', {
    p_payment_id: reservation.payment_id,
    p_provider_order_id: providerOrder.id,
  })
  if (attachError) return json({ error: 'Payment provider reconciliation is required' }, 409)

  const attached = (Array.isArray(attachedData) ? attachedData[0] : attachedData) as
    | { provider_order_id?: unknown }
    | null
  if (attached?.provider_order_id !== providerOrder.id) {
    return json({ error: 'Payment provider reconciliation is required' }, 409)
  }

  return json({ orderId: reservation.order_id, paymentId: reservation.payment_id,
    providerOrderId: providerOrder.id, amount, currency, keyId })
}
