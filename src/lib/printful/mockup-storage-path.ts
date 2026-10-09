import 'server-only'

import { createHash } from 'node:crypto'

// Deterministic, collision-resistant media object names for stable retries.
// The database ledger enforces one file identity per product and unique paths.
export function printfulMockupStoragePath(productId: string, printfulFileId: number): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(productId)
      || !Number.isSafeInteger(printfulFileId) || printfulFileId <= 0) {
    throw new Error('INVALID_MEDIA_IDENTITY')
  }
  const hash = createHash('sha256')
    .update(`evolevex:printful:mockup:v1:${productId}:${printfulFileId}`)
    .digest('hex')
  const uuid = [hash.slice(0,8),hash.slice(8,12),`4${hash.slice(13,16)}`,
    `a${hash.slice(17,20)}`,hash.slice(20,32)].join('-')
  return `${productId}/${uuid}.png`
}
