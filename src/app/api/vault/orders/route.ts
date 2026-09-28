import { NextRequest, NextResponse } from 'next/server'

import { getCurrencyPreference } from '@/lib/currency-preference'
import { isSupportedCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/server'
import { isSameOrigin } from '@/lib/view-tracking'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const POSITIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/

type OrderSnapshot = {
  order_id: unknown
  order_status: unknown
  payment_status: unknown
  currency: unknown
  total_amount: unknown
  created: unknown
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
    || Object.keys(body).length !== 1 || !('productId' in body)
    || typeof body.productId !== 'string' || !UUID.test(body.productId)) {
    return json({ error: 'Invalid request body' }, 400)
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Authentication required' }, 401)

  const selectedCurrency = await getCurrencyPreference()
  const { data, error } = await supabase.rpc('create_pending_evo_vault_order', {
    p_vault_product_id: body.productId,
    p_requested_currency: selectedCurrency,
  })
  if (error) return json({ error: 'Unable to create order' }, 409)

  const snapshot = (Array.isArray(data) ? data[0] : data) as OrderSnapshot | null
  const amount = snapshot && (typeof snapshot.total_amount === 'string'
    || typeof snapshot.total_amount === 'number') ? String(snapshot.total_amount) : ''
  const numericAmount = Number(amount)
  if (!snapshot || !UUID.test(String(snapshot.order_id ?? ''))
    || snapshot.order_status !== 'pending' || snapshot.payment_status !== 'pending'
    || !isSupportedCurrency(snapshot.currency)
    || !POSITIVE_DECIMAL.test(amount) || !Number.isFinite(numericAmount) || numericAmount <= 0
    || typeof snapshot.created !== 'boolean') {
    return json({ error: 'Unable to create order' }, 500)
  }

  return json({
    orderId: snapshot.order_id,
    orderStatus: snapshot.order_status,
    paymentStatus: snapshot.payment_status,
    currency: snapshot.currency,
    totalAmount: snapshot.total_amount,
    created: snapshot.created,
  })
}
