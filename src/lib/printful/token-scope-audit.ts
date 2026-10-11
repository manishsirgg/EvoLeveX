import 'server-only'

export type PrintfulTokenScopeAudit =
  | { ok: true; scopes: string[]; shippingAccess: 'not-established'; note: string }
  | { ok: false; code: 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'INVALID_RESPONSE' }

export function parsePrintfulScopes(input: unknown): string[] {
  if (!input || typeof input !== 'object') throw new Error('INVALID_RESPONSE')
  const body = input as Record<string, unknown>
  if (body.code !== 200 || !body.result || typeof body.result !== 'object') throw new Error('INVALID_RESPONSE')
  const scopes = (body.result as Record<string, unknown>).scopes
  if (!Array.isArray(scopes) || scopes.length > 100) throw new Error('INVALID_RESPONSE')
  const values = scopes.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('INVALID_RESPONSE')
    const scope = (item as Record<string, unknown>).scope
    if (typeof scope !== 'string' || !/^[a-z0-9/_-]{1,80}$/.test(scope)) throw new Error('INVALID_RESPONSE')
    return scope
  })
  return [...new Set(values)].sort()
}

export async function inspectPrintfulTokenScopes(): Promise<PrintfulTokenScopeAudit> {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token || process.env.PRINTFUL_STORE_ID !== '18878485') return { ok: false, code: 'NOT_CONFIGURED' }
  try {
    const response = await fetch('https://api.printful.com/oauth/scopes', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-PF-Store-Id': '18878485',
        Accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return { ok: false, code: 'UNAVAILABLE' }
    return {
      ok: true,
      scopes: parsePrintfulScopes(await response.json()),
      shippingAccess: 'not-established',
      note: 'These are observed OAuth token scopes only. No shipping-rate access has been proven. This check does not request a quote, create an order, or authorize broader permissions.',
    }
  } catch {
    return { ok: false, code: 'INVALID_RESPONSE' }
  }
}
