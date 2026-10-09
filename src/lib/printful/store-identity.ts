import 'server-only'

const EXPECTED_STORE_ID = 18878485

// Independent, authenticated Printful store identity check.
// Fail closed if a store-scoped token cannot read this endpoint.
export async function verifyPrintfulStoreIdentity(): Promise<boolean> {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token || process.env.PRINTFUL_STORE_ID !== String(EXPECTED_STORE_ID)) return false
  try {
    const response = await fetch(`https://api.printful.com/stores/${EXPECTED_STORE_ID}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
      redirect: 'error',
    })
    if (!response.ok) return false
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return false
    const data = payload as Record<string, unknown>
    if (data.code !== 200 || !data.result || typeof data.result !== 'object') return false
    const store = data.result as Record<string, unknown>
    return store.id === EXPECTED_STORE_ID && store.name === "EvoLeveX's Store"
  } catch {
    return false
  }
}
