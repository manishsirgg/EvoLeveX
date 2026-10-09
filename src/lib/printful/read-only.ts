import 'server-only'

const API_ORIGIN = 'https://api.printful.com'
const MAX_ITEMS = 10

export type PrintfulProductSummary = { id: number; name: string; variants: number }
export type PrintfulProbe = { connected: boolean; productCount: number; products: PrintfulProductSummary[]; error?: string }

function parseProduct(value: unknown): PrintfulProductSummary | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || typeof item.name !== 'string') return null
  return { id: item.id, name: item.name.slice(0, 160), variants: typeof item.variants === 'number' && Number.isSafeInteger(item.variants) ? item.variants : 0 }
}

export function parsePrintfulProductResponse(payload: unknown): PrintfulProductSummary[] {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_RESPONSE')
  const response = payload as Record<string, unknown>
  if (response.code !== 200 || !Array.isArray(response.result)) throw new Error('INVALID_RESPONSE')
  return response.result.slice(0, MAX_ITEMS).map(parseProduct).filter((p): p is PrintfulProductSummary => p !== null)
}

// Called exclusively inside an administrator-authorized server action.
// Never persist the token or return upstream error bodies to the caller.
export async function probePrintfulConnection(): Promise<PrintfulProbe> {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) return { connected: false, productCount: 0, products: [], error: 'TOKEN_NOT_CONFIGURED' }
  try {
    const controller = new AbortController()
    const response = await fetch(`${API_ORIGIN}/store/products?limit=${MAX_ITEMS}&offset=0`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
      redirect: 'error',
    })
    if (!response.ok) return { connected: false, productCount: 0, products: [], error: response.status === 401 || response.status === 403 ? 'AUTH_FAILED' : 'PRINTFUL_UNAVAILABLE' }
    const payload: unknown = await response.json()
    const products = parsePrintfulProductResponse(payload)
    return { connected: true, productCount: products.length, products }
  } catch {
    return { connected: false, productCount: 0, products: [], error: 'PRINTFUL_UNAVAILABLE' }
  }
}
