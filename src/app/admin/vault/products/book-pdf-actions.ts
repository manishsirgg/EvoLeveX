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

type BookPdfActionState = { error?: string; success?: string; warning?: string }
type Supabase = Awaited<ReturnType<typeof createClient>>
type BookRow = { id: string; vault_product_id: string; digital_file_path: string | null; digital_file_size: number | null }
type UploadRow = { id: string; vault_product_id: string; storage_path: string; expected_file_path: string | null }

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

async function claimUpload(supabase: Supabase, uploadId: string, productId: string): Promise<UploadRow | null> {
  if (!UUID.test(uploadId) || !UUID.test(productId)) return null
  const upload = await supabase
    .from('evo_vault_book_pdf_uploads')
    .delete()
    .eq('id', uploadId)
    .eq('vault_product_id', productId)
    .select('id,vault_product_id,storage_path,expected_file_path')
    .maybeSingle()
  return upload.error || !upload.data ? null : upload.data as UploadRow
}

async function cleanupPreparedUpload(supabase: Supabase, upload: UploadRow, book: BookRow | null) {
  const managedPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, upload.storage_path, upload.vault_product_id)
  if (!managedPath || book?.digital_file_path === managedPath) return false
  const cleanup = await supabase.storage.from(VAULT_BOOK_PDF_BUCKET).remove([managedPath])
  if (cleanup.error) return false
  return true
}

function refreshEditor(productId: string) {
  revalidatePath(`/admin/vault/products/${productId}/edit`)
}

export async function prepareVaultBookPdfUploadAction(productId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const book = await loadBook(supabase, productId)
  if (!book) return { error: 'This book product is unavailable.' }

  const path = vaultBookPdfPath(book.vault_product_id)
  const prepared = await supabase
    .from('evo_vault_book_pdf_uploads')
    .insert({
      vault_product_id: book.vault_product_id,
      storage_path: path,
      expected_file_path: book.digital_file_path,
    })
    .select('id')
    .single()
  if (prepared.error || !prepared.data) return { error: 'The PDF upload could not be prepared. Please try again.' }

  return { uploadId: prepared.data.id as string, path, bucket: VAULT_BOOK_PDF_BUCKET }
}

export async function finalizeVaultBookPdfUploadAction(productId: string, uploadId: string, proposedPath: string, validatedSize: number): Promise<BookPdfActionState> {
  await requireAdmin()
  const supabase = await createClient()
  const book = await loadBook(supabase, productId)
  const upload = await claimUpload(supabase, uploadId, productId)
  if (!book || !upload) return { error: 'This prepared PDF upload is unavailable or expired.' }

  const trustedPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, upload.storage_path, book.vault_product_id)
  if (!trustedPath || proposedPath !== trustedPath) {
    const cleaned = await cleanupPreparedUpload(supabase, upload, book)
    return { error: cleaned ? 'The prepared PDF path is invalid; the prepared upload was removed.' : 'The prepared PDF path is invalid, and cleanup failed; manual cleanup may be required.' }
  }
  if (!Number.isSafeInteger(validatedSize) || validatedSize <= 0 || validatedSize > VAULT_BOOK_PDF_MAX_BYTES) {
    const cleaned = await cleanupPreparedUpload(supabase, upload, book)
    return { error: cleaned ? 'The uploaded PDF size is invalid; the upload was removed.' : 'The uploaded PDF size is invalid, and cleanup failed; manual cleanup may be required.' }
  }
  if (book.digital_file_path !== upload.expected_file_path) {
    const cleaned = await cleanupPreparedUpload(supabase, upload, book)
    return { error: cleaned ? 'A newer PDF change was detected. This stale upload was removed.' : 'A newer PDF change was detected. The stale upload could not be cleaned up; manual cleanup may be required.' }
  }

  const object = await supabase.storage.from(VAULT_BOOK_PDF_BUCKET).info(trustedPath)
  const actualSize = object.data?.size
  const contentType = object.data?.contentType
  if (object.error || !Number.isSafeInteger(actualSize) || !actualSize || actualSize > VAULT_BOOK_PDF_MAX_BYTES || actualSize !== validatedSize || contentType !== 'application/pdf') {
    const cleaned = await cleanupPreparedUpload(supabase, upload, book)
    return { error: cleaned ? 'Storage could not verify the uploaded PDF; the upload was removed.' : 'Storage could not verify the uploaded PDF, and cleanup failed; manual cleanup may be required.' }
  }

  let updateQuery = supabase
    .from('evo_vault_books')
    .update({ digital_file_path: trustedPath, digital_file_size: actualSize })
    .eq('id', book.id)
  updateQuery = upload.expected_file_path === null
    ? updateQuery.is('digital_file_path', null)
    : updateQuery.eq('digital_file_path', upload.expected_file_path)
  const update = await updateQuery.select('id').maybeSingle()

  if (update.error || !update.data) {
    const currentBook = await loadBook(supabase, productId)
    const cleaned = await cleanupPreparedUpload(supabase, upload, currentBook)
    return { error: cleaned ? 'The PDF could not be attached. The existing PDF was preserved and the new upload was removed.' : 'The PDF could not be attached. The existing PDF was preserved, but cleanup failed; manual cleanup may be required.' }
  }

  refreshEditor(book.vault_product_id)
  if (upload.expected_file_path) {
    const oldPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, upload.expected_file_path, book.vault_product_id)
    if (!oldPath) return { success: 'PDF replaced.', warning: 'The previous file reference was outside the managed book namespace and was not deleted; manual cleanup may be required.' }
    const cleanup = await supabase.storage.from(VAULT_BOOK_PDF_BUCKET).remove([oldPath])
    if (cleanup.error) return { success: 'PDF replaced.', warning: 'The previous managed PDF could not be removed; manual cleanup may be required.' }
    return { success: 'PDF replaced.' }
  }
  return { success: 'PDF uploaded.' }
}

export async function abortVaultBookPdfUploadAction(productId: string, uploadId: string): Promise<BookPdfActionState> {
  await requireAdmin()
  const supabase = await createClient()
  const upload = await claimUpload(supabase, uploadId, productId)
  const book = await loadBook(supabase, productId)
  if (!book || !upload) return { error: 'The prepared upload could not be found for cleanup.' }
  const cleaned = await cleanupPreparedUpload(supabase, upload, book)
  return cleaned
    ? { success: 'The unattached upload was removed.' }
    : { warning: 'The unattached upload could not be removed; manual cleanup may be required.' }
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
