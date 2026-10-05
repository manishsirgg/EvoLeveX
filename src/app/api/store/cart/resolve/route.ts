import { NextRequest, NextResponse } from 'next/server'

import { getCurrencyPreference } from '@/lib/currency-preference'
import { normalizeStoreCartItems, STORE_CART_MAX_BYTES, STORE_CART_MAX_LINES } from '@/lib/store-cart'
import { resolveStoreCart } from '@/lib/store-cart-resolver'
import { isSameOrigin } from '@/lib/view-tracking'

function json(body: object, status = 200) {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: 'Invalid request origin' }, 403)
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > STORE_CART_MAX_BYTES) return json({ error: 'Invalid request body' }, 400)
  let text: string
  try { text = await request.text() } catch { return json({ error: 'Invalid request body' }, 400) }
  if (new TextEncoder().encode(text).byteLength > STORE_CART_MAX_BYTES) return json({ error: 'Invalid request body' }, 400)
  let body: unknown
  try { body = JSON.parse(text) } catch { return json({ error: 'Invalid request body' }, 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('items' in body)) {
    return json({ error: 'Invalid request body' }, 400)
  }
  const rawItems = (body as { items?: unknown }).items
  if (!Array.isArray(rawItems) || rawItems.length > STORE_CART_MAX_LINES
    || rawItems.some((item) => !item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).length !== 2 || !('variant_id' in item) || !('quantity' in item))) {
    return json({ error: 'Invalid request body' }, 400)
  }
  const items = normalizeStoreCartItems(rawItems)
  if (!items) return json({ error: 'Invalid request body' }, 400)
  try {
    return json(await resolveStoreCart(items, await getCurrencyPreference()))
  } catch {
    return json({ error: 'Store cart is temporarily unavailable' }, 503)
  }
}
