// Pure validation boundary for the future atomic Printful draft importer.
// No database writes, credentials, or network activity.
export type DraftVariant = {
  syncId: string
  catalogId: string
  sku: string
  size: string | null
  color: string | null
}
export type DraftImportCandidate = {
  syncProductId: string
  title: string
  slug: string
  variants: DraftVariant[]
}

const numericId = (value: number) => Number.isSafeInteger(value) && value > 0
const code = /^[A-Z0-9][A-Z0-9._/-]{0,63}$/
const dimension = /^[A-Z0-9][A-Z0-9._/-]{0,31}$/

export function normalizePrintfulDraftCandidate(detail: {
  id: number
  name: string
  variants: { syncId: number; catalogId: number | null; name: string; sku: string | null; synced: boolean }[]
}): DraftImportCandidate {
  if (!numericId(detail.id) || !detail.name.trim() || detail.variants.length < 1 || detail.variants.length > 100) {
    throw new Error('INVALID_PRINTFUL_PRODUCT')
  }
  const title = detail.name.trim().slice(0, 120)
  const slug = `printful-${detail.id}`
  const seenIds = new Set<number>()
  const seenSku = new Set<string>()
  const seenDimensions = new Set<string>()
  const variants = detail.variants.map((item): DraftVariant => {
    if (!numericId(item.syncId) || !numericId(item.catalogId ?? 0) || !item.synced || seenIds.has(item.syncId)) {
      throw new Error('INVALID_PRINTFUL_VARIANT')
    }
    seenIds.add(item.syncId)
    const sku = (item.sku ?? '').trim().toUpperCase()
    if (!code.test(sku) || seenSku.has(sku)) throw new Error('INVALID_PRINTFUL_SKU')
    seenSku.add(sku)
    // This preliminary candidate requires explicit dimensions and cannot guess
    // a size or color from the human-readable variant name.
    const match = item.name.match(/\/\s*([^/]+)\s*\/\s*([^/]+)\s*$/)
    if (!match) throw new Error('UNRESOLVED_VARIANT_DIMENSIONS')
    const color = match[1].trim().toUpperCase().replace(/\s+/g, '-')
    const size = match[2].trim().toUpperCase()
    if (!dimension.test(color) || !dimension.test(size)) throw new Error('INVALID_PRINTFUL_DIMENSIONS')
    const key = `${size}| ${color}`
    if (seenDimensions.has(key)) throw new Error('DUPLICATE_PRINTFUL_DIMENSIONS')
    seenDimensions.add(key)
    return { syncId: String(item.syncId), catalogId: String(item.catalogId), sku, size, color }
  })
  return { syncProductId: String(detail.id), title, slug, variants }
}
