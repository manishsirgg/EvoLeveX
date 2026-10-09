import 'server-only'

const MAX_BYTES = 5 * 1024 * 1024
const MIN_SIDE = 400
const MAX_SIDE = 5000

export type ValidatedPng = { bytes: Uint8Array; width: number; height: number }

export function validatePrintfulPng(bytes: Uint8Array, contentType: string | null): ValidatedPng {
  if (contentType?.split(';')[0].trim().toLowerCase() !== 'image/png') throw new Error('INVALID_CONTENT_TYPE')
  if (bytes.length < 33 || bytes.length > MAX_BYTES) throw new Error('INVALID_FILE_SIZE')
  const pngHeader = [137,80,78,71,13,10,26,10]
  if (!pngHeader.every((part, index) => bytes[index] === part)) throw new Error('INVALID_PNG_SIGNATURE')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12,16)) !== 'IHDR') throw new Error('INVALID_PNG_HEADER')
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  const compression = bytes[26]
  const filter = bytes[27]
  const interlace = bytes[28]
  if (width < MIN_SIDE || height < MIN_SIDE || width > MAX_SIDE || height > MAX_SIDE || compression !== 0 || filter !== 0 || ![0,1].includes(interlace)) throw new Error('INVALID_PNG_DIMENSIONS')
  // PNG structure and image decoding must still be verified before writes using a trusted decoder.
  return { bytes, width, height }
}

export async function fetchValidatedPrintfulPng(providerUrl: string): Promise<ValidatedPng> {
  const url = new URL(providerUrl)
  if (url.protocol !== 'https:' || url.hostname !== 'files.cdn.printful.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/files\/[a-zA-Z0-9/_-]+_preview\.png$/.test(url.pathname)) throw new Error('PROVIDER_URL_REJECTED')
  const response = await fetch(url.toString(), {
    method: 'GET', redirect: 'error', cache: 'no-store',
    headers: { Accept: 'image/png' },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok || !response.body) throw new Error('PROVIDER_FETCH_FAILED')
  const declared = Number(response.headers.get('content-length') || '0')
  if (declared > MAX_BYTES) throw new Error('FILE_TOO_LARGE')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > MAX_BYTES) throw new Error('FILE_TOO_LARGE')
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return validatePrintfulPng(bytes, response.headers.get('content-type'))
}
