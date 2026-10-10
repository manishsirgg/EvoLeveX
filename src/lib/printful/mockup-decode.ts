import 'server-only'
import sharp from 'sharp'
import { fetchValidatedPrintfulPng } from './mockup-ingestion-validate'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_PIXELS = 8_000_000

export async function decodeApprovedPrintfulMockup(url: string): Promise<Uint8Array> {
  const downloaded = await fetchValidatedPrintfulPng(url)
  const input = Buffer.from(downloaded.bytes)
  // Decode every pixel, normalize to PNG and remove source metadata.
  const decoder = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
  const metadata = await decoder.metadata()
  if (metadata.format !== 'png' || metadata.width !== downloaded.width
      || metadata.height !== downloaded.height || metadata.pages && metadata.pages !== 1) {
    throw new Error('MOCKUP_DECODING_REJECTED')
  }
  const normalized = await decoder.png({ compressionLevel: 9 }).toBuffer()
  if (normalized.length === 0 || normalized.length > MAX_BYTES) throw new Error('MOCKUP_TOO_LARGE')
  // Decoding and re-encoding above actively validates compressed pixel content.
  return normalized
}
