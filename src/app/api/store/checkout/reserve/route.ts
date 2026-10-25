import { NextRequest, NextResponse } from 'next/server'

import { getCurrencyPreference } from '@/lib/currency-preference'
import { normalizeStoreCartItems, STORE_CART_MAX_BYTES, STORE_CART_MAX_LINES } from '@/lib/store-cart'
import { createClient } from '@/lib/supabase/server'
import { isSameOrigin } from '@/lib/view-tracking'

// Gated customer checkout reservation endpoint; never initiates payment.
// Explicitly opt in for controlled tests after validating Production RPC deployment.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: object, status = 200) {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function POST(request: NextRequest) {
  // Never accept a payment request from this route.
  if (process.env.STORE_RESERVATION_BRIDGE_ENABLED !== 'true')
    return json({ error: 'Checkout reservations are not available' }, 503)
  if (!isSameOrigin(request)) return json({ error: 'Invalid origin' }, 403)
  const length = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(length) && length > STORE_CART_MAX_BYTES)
    return json({ error: 'Invalid request body' }, 400)
  let source: string
  try { source = await request.text() } catch { return json({ error: 'Invalid request body' }, 400) }
  if (new TextEncoder().encode(source).byteLength > STORE_CART_MAX_BYTES)
    return json({ error: 'Invalid request body' }, 400)
  let body: unknown
  try { body = JSON.parse(source) } catch { return json({ error: 'Invalid request body' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return json({ error: 'Invalid request body' }, 400)
  const fields = body as Record<string, unknown>
  if (Object.keys(fields).length !== 3 ||
      !Object.hasOwn(fields, 'items') || !Object.hasOwn(fields, 'address_id') || !Object.hasOwn(fields, 'idempotency_key') ||
      !Array.isArray(fields.items) || fields.items.length < 1 || fields.items.length > STORE_CART_MAX_LINES ||
      fields.items.some(item => !item || typeof item !== 'object' || Array.isArray(item) ||
        Object.keys(item).length !== 2 || !Object.hasOwn(item, 'variant_id') || !Object.hasOwn(item, 'quantity')) ||
      typeof fields.address_id !== 'string' || !UUID.test(fields.address_id) ||
      typeof fields.idempotency_key !== 'string' || !UUID.test(fields.idempotency_key))
    return json({ error: 'Invalid request body' }, 400)
  const items = normalizeStoreCartItems(fields.items)
  if (!items?.length) return json({ error: 'Invalid request body' }, 400)

  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) return json({ error: 'Sign in required' }, 401)
  // Existing SECURITY DEFINER RPC owns price, address, stock and idempotency checks.
  // Browser-supplied amounts, order status and payment facts are never accepted.
  const { data, error } = await supabase.rpc('create_evo_store_checkout', {
    p_items: items,
    p_currency: await getCurrencyPreference(),
    p_idempotency_key: fields.idempotency_key,
    p_address_id: fields.address_id,
  })
  if (error) {
    // Fail closed. RPC may reject out-of-stock, address mismatch, conflict or unavailable prices.
    return json({ error: 'Unable to reserve this cart. Please refresh and try again.' }, 409)
  }
  return json({ reservation: data }, 201)
}
