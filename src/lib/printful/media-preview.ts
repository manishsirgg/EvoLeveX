import 'server-only'

import { verifyPrintfulStoreIdentity } from './store-identity'

const STORE_ID = '18878485'
const MAX_VARIANTS = 100
const MAX_CANDIDATES = 30

export type PrintfulMediaCandidate = {
  syncVariantId: number
  fileId: number
  type: string
  previewUrl: string
}
export type PrintfulMediaResult =
  | { candidates: PrintfulMediaCandidate[]; inspectedVariants: number }
  | { error: 'INVALID_ID' | 'STORE_UNVERIFIED' | 'UPSTREAM_FAILED' | 'INVALID_RESPONSE' }

function approvedPreviewUrl(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 2048) return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (!url.hostname.endsWith('.printful.com') && url.hostname !== 'printful.com') return null
    return url.toString()
  } catch { return null }
}

export function parsePrintfulMediaCandidates(input: unknown): { candidates: PrintfulMediaCandidate[]; inspectedVariants: number } {
  if (!input || typeof input !== 'object') throw new Error('INVALID_RESPONSE')
  const payload = input as Record<string, unknown>
  if (payload.code !== 200 || !payload.result || typeof payload.result !== 'object') throw new Error('INVALID_RESPONSE')
  const result = payload.result as Record<string, unknown>
  if (!Array.isArray(result.sync_variants) || result.sync_variants.length > MAX_VARIANTS) throw new Error('INVALID_RESPONSE')
  const candidates: PrintfulMediaCandidate[] = []
  const seen = new Set<string>()
  for (const raw of result.sync_variants) {
    if (!raw || typeof raw !== 'object') throw new Error('INVALID_RESPONSE')
    const variant = raw as Record<string, unknown>
    if (!Number.isSafeInteger(variant.id)) throw new Error('INVALID_RESPONSE')
    if (!Array.isArray(variant.files)) continue
    for (const rawFile of variant.files) {
      if (!rawFile || typeof rawFile !== 'object') continue
      const file = rawFile as Record<string, unknown>
      const previewUrl = approvedPreviewUrl(file.preview_url)
      if (!Number.isSafeInteger(file.id) || !previewUrl) continue
      const type = typeof file.type === 'string' ? file.type.slice(0, 32) : 'unknown'
      const fingerprint = String(file.id) + '|' + previewUrl
      if (seen.has(fingerprint)) continue
      seen.add(fingerprint)
      if (candidates.length < MAX_CANDIDATES) candidates.push({
        syncVariantId: variant.id as number, fileId: file.id as number, type, previewUrl,
      })
    }
  }
  return { candidates, inspectedVariants: result.sync_variants.length }
}

export async function previewPrintfulMedia(id: number): Promise<PrintfulMediaResult> {
  if (!Number.isSafeInteger(id) || id <= 0) return { error: 'INVALID_ID' }
  if (process.env.PRINTFUL_STORE_ID !== STORE_ID || !await verifyPrintfulStoreIdentity()) return { error: 'STORE_UNVERIFIED' }
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) return { error: 'STORE_UNVERIFIED' }
  try {
    const response = await fetch(`https://api.printful.com/store/products/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-PF-Store-Id': STORE_ID, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error'
    })
    if (!response.ok) return { error: 'UPSTREAM_FAILED' }
    return parsePrintfulMediaCandidates(await response.json())
  } catch {
    return { error: 'INVALID_RESPONSE' }
  }
}
