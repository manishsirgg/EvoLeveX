import 'server-only'

const PRODUCT_ID = 479728769
const SYNC_VARIANT_ID = 5562164619
const CATALOG_VARIANT_ID = 4866

type KnownNumber = number | null
type FileAudit = {
  placement: string
  fileId: number | null
  kind: 'PREVIEW' | 'PRINT_PLACEMENT' | 'UNCLASSIFIED'
  width: KnownNumber
  height: KnownNumber
  dpi: KnownNumber
  mimeType: string | null
  sizeBytes: KnownNumber
  optionsCount: number | null
  note: string
}
export type BlackSFileAuditResult =
  | { ok: true; syncVariantId: number; catalogVariantId: number; files: FileAudit[]; conclusion: string }
  | { ok: false; code: 'TOKEN_NOT_CONFIGURED' | 'PRODUCT_UNAVAILABLE' | 'INVALID_RESPONSE' | 'BLACK_S_NOT_FOUND' }

function safeInt(x: unknown): KnownNumber { return typeof x === 'number' && Number.isSafeInteger(x) && x > 0 ? x : null }
function safeText(x: unknown): string | null { return typeof x === 'string' && /^[a-z0-9+./_-]{1,64}$/i.test(x) ? x : null }
function asRecord(x: unknown): Record<string,unknown> | null { return x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string,unknown> : null }

export function parseBlackSFileAudit(payload: unknown): BlackSFileAuditResult {
  const envelope = asRecord(payload)
  const result = asRecord(envelope?.result)
  const product = asRecord(result?.sync_product)
  if (envelope?.code !== 200 || !product || product.id !== PRODUCT_ID || !Array.isArray(result?.sync_variants)) return { ok: false, code: 'INVALID_RESPONSE' }
  if (result.sync_variants.length !== 18) return { ok: false, code: 'INVALID_RESPONSE' }
  const matches = result.sync_variants.map(asRecord).filter(v => v?.id === SYNC_VARIANT_ID)
  if (matches.length !== 1 || !matches[0]) return { ok: false, code: 'BLACK_S_NOT_FOUND' }
  const black = matches[0]
  if (black.variant_id !== CATALOG_VARIANT_ID || !Array.isArray(black.files) || black.files.length > 20) return { ok: false, code: 'INVALID_RESPONSE' }
  const files: FileAudit[] = []
  for (const raw of black.files) {
    const f = asRecord(raw)
    if (!f) return { ok: false, code: 'INVALID_RESPONSE' }
    const placement = safeText(f.type) ?? 'unspecified'
    const kind = placement === 'preview' ? 'PREVIEW' : ['default','front','back','sleeve_left','sleeve_right'].includes(placement) ? 'PRINT_PLACEMENT' : 'UNCLASSIFIED'
    files.push({
      placement, fileId: safeInt(f.id), kind,
      width: safeInt(f.width), height: safeInt(f.height), dpi: safeInt(f.dpi),
      mimeType: safeText(f.mime_type), sizeBytes: safeInt(f.size),
      optionsCount: Array.isArray(f.options) ? f.options.length : null,
      note: kind === 'PREVIEW' ? 'Preview is not evidence of printable artwork' :
        kind === 'PRINT_PLACEMENT' ? 'File association only; artwork suitability and print placement remain unverified' :
        'Unknown file purpose; manual inspection required',
    })
  }
  return { ok: true, syncVariantId: SYNC_VARIANT_ID, catalogVariantId: CATALOG_VARIANT_ID, files,
    conclusion: 'Metadata only: missing dimensions or DPI are unknown, not zero. A file ID does not prove printable resolution, licensing, placement accuracy, front/back print selection, or production-cost readiness. No file URLs or artwork bytes are returned.' }
}

export async function inspectBlackSFileMetadata(): Promise<BlackSFileAuditResult> {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) return { ok: false, code: 'TOKEN_NOT_CONFIGURED' }
  try {
    const response = await fetch('https://api.printful.com/store/products/479728769', {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, 'X-PF-Store-Id': '18878485', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error',
    })
    if (!response.ok) return { ok: false, code: 'PRODUCT_UNAVAILABLE' }
    return parseBlackSFileAudit(await response.json())
  } catch { return { ok: false, code: 'PRODUCT_UNAVAILABLE' } }
}
