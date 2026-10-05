/** Browser Store carts are untrusted identity hints. Server code must re-resolve them. */
export const STORE_CART_STORAGE_KEY = 'evo_store_cart_v1'
export const STORE_CART_VERSION = 1 as const
export const STORE_CART_MAX_QUANTITY = 10
export const STORE_CART_MAX_LINES = 50
export const STORE_CART_MAX_BYTES = 16 * 1024

export type StoreCartItem = { variant_id: string; quantity: number }
export type PersistedStoreCart = { version: typeof STORE_CART_VERSION; items: StoreCartItem[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isStoreVariantId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function isStoreCartQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 1 && value <= STORE_CART_MAX_QUANTITY
}

export function normalizeStoreCartItems(value: unknown): StoreCartItem[] | null {
  if (!Array.isArray(value) || value.length > STORE_CART_MAX_LINES) return null
  const normalized: StoreCartItem[] = []
  const positions = new Map<string, number>()
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
    const item = candidate as Record<string, unknown>
    if (!isStoreVariantId(item.variant_id) || !isStoreCartQuantity(item.quantity)) return null
    const id = item.variant_id.toLowerCase()
    const existing = positions.get(id)
    if (existing === undefined) {
      if (normalized.length >= STORE_CART_MAX_LINES) return null
      positions.set(id, normalized.length)
      normalized.push({ variant_id: id, quantity: item.quantity })
    } else {
      normalized[existing].quantity = Math.min(
        STORE_CART_MAX_QUANTITY,
        normalized[existing].quantity + item.quantity,
      )
    }
  }
  return normalized
}

export function parseStoreCartPayload(serialized: string | null): PersistedStoreCart | null {
  if (serialized === null || new TextEncoder().encode(serialized).byteLength > STORE_CART_MAX_BYTES) return null
  try {
    const payload: unknown = JSON.parse(serialized)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    const record = payload as Record<string, unknown>
    if (record.version !== STORE_CART_VERSION) return null
    const items = normalizeStoreCartItems(record.items)
    return items ? { version: STORE_CART_VERSION, items } : null
  } catch {
    return null
  }
}

export function serializeStoreCart(items: StoreCartItem[]): string | null {
  const normalized = normalizeStoreCartItems(items)
  if (!normalized) return null
  const serialized = JSON.stringify({ version: STORE_CART_VERSION, items: normalized })
  return new TextEncoder().encode(serialized).byteLength <= STORE_CART_MAX_BYTES ? serialized : null
}
