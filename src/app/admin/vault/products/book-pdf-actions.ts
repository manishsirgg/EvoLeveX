'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import {
  ownedVaultBookPdfPath,
  VAULT_BOOK_PDF_BUCKET,
  VAULT_BOOK_PDF_MAX_BYTES,
  vaultBookPdfPath,
} from '@/lib/vault-book-pdf'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PDF_SIGNATURE = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])

type BookPdfActionState = { error?: string; success?: string; warning?: string }
type Supabase = Awaited<ReturnType<typeof createClient>>
type BookRow = { id: string; vault_product_id: string; digital_file_path: string | null; digital_file_size: number | null }

async function loadBook(supabase: Supabase, productId: string): Promise<BookRow | null> {
  if (!UUID.test(productId)) return null

  const product = await supabase.from('evo_vault_products').select('id,kind').eq('id', productId).maybeSingle()
  if (product.error || !product.data || product.data.kind !== 'book') return null

  const book = await supabase
    .from('evo_vault_books')
    .select('id,vault_product_id,digital_file_path,digital_file_size')
    .eq('vault_product_id', product.data.id)
    .maybeSingle()
  return book.error || !book.data ? null : book.data as BookRow
}

async function validatePdf(data: FormData) {
  const file = data.get('book_pdf')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a non-empty PDF to upload.' }
  if (file.size > VAULT_BOOK_PDF_MAX_BYTES) return { error: 'Book PDFs must be 50 MB or smaller.' }
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    return { error: 'Choose a PDF file.' }
  }

  const signature = new Uint8Array(await file.slice(0, PDF_SIGNATURE.length).arrayBuffer())
  if (signature.length !== PDF_SIGNATURE.length || !PDF_SIGNATURE.every((byte, index) => signature[index] === byte)) {
    return { error: 'The selected file is not a valid PDF.' }
  }
  return { file }
}

async function removeNewUpload(supabase: Supabase, path: string) {
  const cleanup = await supabase.storage.from(VAULT_BOOK_PDF_BUCKET).remove([path])
  return !cleanup.error
}

function refreshEditor(productId: string) {
  revalidatePath(`/admin/vault/products/${productId}/edit`)
}

export async function uploadVaultBookPdfAction(productId: string, _state: BookPdfActionState, data: FormData): Promise<BookPdfActionState> {
  void _state
  await requireAdmin()
  const supabase = await createClient()
  const book = await loadBook(supabase, productId)
  if (!book) return { error: 'This book product is unavailable.' }

  const pdf = await validatePdf(data)
  if (pdf.error || !pdf.file) return { error: pdf.error }

  const trustedProductId = book.vault_product_id
  const newPath = vaultBookPdfPath(trustedProductId)
  const upload = await supabase.storage.from(VAULT_BOOK_PDF_BUCKET).upload(newPath, pdf.file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (upload.error) return { error: book.digital_file_path ? 'The replacement PDF could not be uploaded. The existing PDF was preserved.' : 'The PDF could not be uploaded. Please try again.' }

  let updateQuery = supabase
    .from('evo_vault_books')
    .update({ digital_file_path: newPath, digital_file_size: pdf.file.size })
    .eq('id', book.id)
  updateQuery = book.digital_file_path === null
    ? updateQuery.is('digital_file_path', null)
    : updateQuery.eq('digital_file_path', book.digital_file_path)
  const update = await updateQuery.select('id').maybeSingle()

  if (update.error || !update.data) {
    const cleaned = await removeNewUpload(supabase, newPath)
    return cleaned
      ? { error: book.digital_file_path ? 'The replacement PDF could not be attached. The existing PDF was preserved.' : 'The PDF could not be attached. Its uploaded file was removed; please try again.' }
      : { error: book.digital_file_path ? 'The replacement PDF could not be attached. The existing PDF was preserved, but the new upload could not be cleaned up; manual cleanup may be required.' : 'The PDF could not be attached, and its uploaded file could not be cleaned up; manual cleanup may be required.' }
  }

  refreshEditor(trustedProductId)
  if (book.digital_file_path) {
    const oldPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, book.digital_file_path, trustedProductId)
    if (!oldPath) return { success: 'PDF replaced.', warning: 'The previous file reference was outside the managed book namespace and was not deleted; manual cleanup may be required.' }
    const cleanup = await supabase.storage.from(VAULT_BOOK_PDF_BUCKET).remove([oldPath])
    if (cleanup.error) return { success: 'PDF replaced.', warning: 'The previous managed PDF could not be removed; manual cleanup may be required.' }
    return { success: 'PDF replaced.' }
  }
  return { success: 'PDF uploaded.' }
}

export async function removeVaultBookPdfAction(productId: string, _state: BookPdfActionState, _data: FormData): Promise<BookPdfActionState> {
  void _state
  void _data
  await requireAdmin()
  const supabase = await createClient()
  const book = await loadBook(supabase, productId)
  if (!book) return { error: 'This book product is unavailable.' }
  if (!book.digital_file_path) return { success: 'No PDF was attached to this book.' }

  const oldPath = book.digital_file_path
  const clear = await supabase
    .from('evo_vault_books')
    .update({ digital_file_path: null, digital_file_size: null })
    .eq('id', book.id)
    .eq('digital_file_path', oldPath)
    .select('id')
    .maybeSingle()
  if (clear.error || !clear.data) return { error: 'The PDF could not be removed. Please try again.' }

  refreshEditor(book.vault_product_id)
  const managedPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, oldPath, book.vault_product_id)
  if (!managedPath) return { success: 'PDF removed.', warning: 'The previous file reference was outside the managed book namespace and was not deleted; manual cleanup may be required.' }
  const cleanup = await supabase.storage.from(VAULT_BOOK_PDF_BUCKET).remove([managedPath])
  return cleanup.error
    ? { success: 'PDF removed.', warning: 'The detached managed PDF could not be deleted; manual cleanup may be required.' }
    : { success: 'PDF removed.' }
}
