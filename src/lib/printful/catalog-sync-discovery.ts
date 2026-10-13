import 'server-only'
import { verifyPrintfulStoreIdentity } from './store-identity'

const STORE_ID = '18878485'
const LIMIT = 20
const MAX_PAGES = 10

export type SyncCatalogRow = { syncProductId: number; title: string; variantCount: number }
export type SyncCatalogDiscovery =
  | { ok: true; products: SyncCatalogRow[]; truncated: boolean; note: string }
  | { ok: false; code: 'DISABLED' | 'STORE_NOT_VERIFIED' | 'TOKEN_NOT_CONFIGURED' | 'UPSTREAM_ERROR' | 'INVALID_RESPONSE' }

export function parseSyncCatalogPage(payload: unknown): SyncCatalogRow[] {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_RESPONSE')
  const body = payload as Record<string, unknown>
  if (body.code !== 200 || !Array.isArray(body.result) || body.result.length > LIMIT) throw new Error('INVALID_RESPONSE')
  return body.result.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('INVALID_RESPONSE')
    const item = raw as Record<string,unknown>
    if (!Number.isSafeInteger(item.id) || (item.id as number) <= 0 ||
      typeof item.name !== 'string' || !item.name.trim() || item.name.length > 500 ||
      !Number.isSafeInteger(item.variants) || (item.variants as number) < 0) throw new Error('INVALID_RESPONSE')
    return { syncProductId: item.id as number, title: item.name.trim().slice(0,160), variantCount: item.variants as number }
  })
}

// Discovery is intentionally non-mutating. A separate reviewed DB reconciliation operation
// will be required before anything is inserted, updated, priced or published.
export async function discoverPrintfulCatalogForReconciliation(): Promise<SyncCatalogDiscovery> {
  if (process.env.PRINTFUL_CATALOG_SYNC_DISCOVERY_ENABLED !== 'true') return { ok: false, code: 'DISABLED' }
  if (process.env.PRINTFUL_STORE_ID !== STORE_ID || !(await verifyPrintfulStoreIdentity()))
    return { ok: false, code: 'STORE_NOT_VERIFIED' }
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) return { ok: false, code: 'TOKEN_NOT_CONFIGURED' }
  const products: SyncCatalogRow[] = []
  const seen = new Set<number>()
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `https://api.printful.com/store/products?limit=${LIMIT}&offset=${page * LIMIT}`
      const response = await fetch(url, {
        method: 'GET', headers: { Authorization: `Bearer ${token}`, 'X-PF-Store-Id': STORE_ID, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error',
      })
      if (!response.ok) return { ok: false, code: 'UPSTREAM_ERROR' }
      const rows = parseSyncCatalogPage(await response.json())
      for (const row of rows) {
        if (seen.has(row.syncProductId)) return { ok: false, code: 'INVALID_RESPONSE' }
        seen.add(row.syncProductId)
        products.push(row)
      }
      if (rows.length < LIMIT) return { ok: true, products, truncated: false,
        note: 'Read-only discovery. This is not a persisted synchronization; variants, mockups and retail prices still require separate reconciliation.' }
    }
    return { ok: true, products, truncated: true,
      note: 'Result truncated at 200 products. Do not reconcile until complete pagination is supported.' }
  } catch (error) {
    return { ok: false, code: error instanceof Error && error.message === 'INVALID_RESPONSE' ? 'INVALID_RESPONSE' : 'UPSTREAM_ERROR' }
  }
}
