export const VAULT_BOOK_PDF_BUCKET = 'evo-private'
export const VAULT_BOOK_PDF_MAX_BYTES = 52_428_800
export const VAULT_BOOK_PDF_ACCEPT = 'application/pdf,.pdf'

const UUID_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/

export function vaultBookPdfPath(productId: string) {
  return `vault/${productId}/books/${crypto.randomUUID()}.pdf`
}

export function ownedVaultBookPdfPath(bucket: string, storagePath: string, productId: string) {
  if (bucket !== VAULT_BOOK_PDF_BUCKET) return null

  const prefix = `vault/${productId}/books/`
  if (!storagePath.startsWith(prefix)) return null

  const filename = storagePath.slice(prefix.length)
  return UUID_FILENAME.test(filename) ? storagePath : null
}
