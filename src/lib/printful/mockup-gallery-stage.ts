import 'server-only'

import { previewPrintfulMedia } from './media-preview'

// First reviewed product/gallery set. Only provider-approved preview assets may be staged.
// This stage performs no network image download, Supabase upload, or database mutation.
const STORE_PRODUCT_ID = 479728769
const VERIFIED_MOCKUPS = [
  { fileId: 1082848720, color: 'BLACK', label: 'Black – front' },
  { fileId: 1082848721, color: 'MIDNIGHT-NAVY', label: 'Midnight Navy – front' },
  { fileId: 1082848722, color: 'COOL-BLUE', label: 'Cool Blue – front' },
] as const

export type StagedMockup = { fileId: number; color: string; label: string; providerUrl: string; sortOrder: number; primary: boolean }
export type MockupStageResult = { ready: true; productId: number; mockups: StagedMockup[] } | { ready: false; code: string }

export async function stagePrintfulMockupGallery(productId: number): Promise<MockupStageResult> {
  if (productId !== STORE_PRODUCT_ID) return { ready: false, code: 'PRODUCT_NOT_APPROVED' }
  const media = await previewPrintfulMedia(productId)
  if ('error' in media) return { ready: false, code: media.error }
  if (media.inspectedVariants !== 18) return { ready: false, code: 'VARIANT_COUNT_CHANGED' }
  const previewFiles = media.candidates.filter(c => c.type === 'preview')
  const mockups: StagedMockup[] = []
  for (const [sortOrder, expected] of VERIFIED_MOCKUPS.entries()) {
    const candidates = previewFiles.filter(c => c.fileId === expected.fileId)
    if (candidates.length !== 1) return { ready: false, code: 'MOCKUP_MISSING_OR_AMBIGUOUS' }
    mockups.push({
      fileId: expected.fileId, color: expected.color, label: expected.label,
      providerUrl: candidates[0].previewUrl, sortOrder, primary: sortOrder === 0
    })
  }
  return { ready: true, productId, mockups }
}
