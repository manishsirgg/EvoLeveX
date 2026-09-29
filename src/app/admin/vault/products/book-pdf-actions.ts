'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  ownedVaultBookPdfPath,
  VAULT_BOOK_PDF_BUCKET,
  VAULT_BOOK_PDF_MAX_BYTES,
  vaultBookPdfPath,
} from '@/lib/vault-book-pdf'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TITLE_MAX = 160

export type BookPdfActionState = { error?: string; success?: string; warning?: string }
type SessionClient = Awaited<ReturnType<typeof createClient>>
type UploadRow = { id: string; vault_product_id: string; storage_path: string; expected_file_path: string | null; target_asset_id: string | null }

async function loadBook(session: SessionClient, productId: string) {
  if (!UUID.test(productId)) return null
  const product = await session.from('evo_vault_products').select('id,kind').eq('id', productId).maybeSingle()
  if (product.error || !product.data || product.data.kind !== 'book') return null
  const book = await session.from('evo_vault_books').select('vault_product_id').eq('vault_product_id', productId).maybeSingle()
  return book.error || !book.data ? null : book.data
}

async function claimUpload(session: SessionClient, uploadId: string, productId: string): Promise<UploadRow | null> {
  if (!UUID.test(uploadId) || !UUID.test(productId)) return null
  const upload = await session.from('evo_vault_book_pdf_uploads').delete().eq('id', uploadId).eq('vault_product_id', productId)
    .select('id,vault_product_id,storage_path,expected_file_path,target_asset_id').maybeSingle()
  return upload.error || !upload.data ? null : upload.data as UploadRow
}

async function removeManagedObject(path: string, productId: string) {
  const managedPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, path, productId)
  if (!managedPath) return false
  const cleanup = await createServiceRoleClient().storage.from(VAULT_BOOK_PDF_BUCKET).remove([managedPath])
  return !cleanup.error
}

function refreshEditor(productId: string) {
  revalidatePath(`/admin/vault/products/${productId}/edit`)
}

function validTitle(title: string) {
  const clean = title.trim()
  return clean && clean.length <= TITLE_MAX ? clean : null
}

export async function prepareVaultBookPdfUploadAction(productId: string, assetId: string | null) {
  await requireAdmin()
  const session = await createClient()
  const book = await loadBook(session, productId)
  if (!book) return { error: 'This book product is unavailable.' }

  let expectedPath: string | null = null
  if (assetId !== null) {
    if (!UUID.test(assetId)) return { error: 'This PDF asset is invalid.' }
    const existing = await createServiceRoleClient().from('evo_vault_book_assets').select('file_path')
      .eq('id', assetId).eq('vault_product_id', productId).eq('is_active', true).maybeSingle()
    if (existing.error || !existing.data) return { error: 'This PDF asset is unavailable.' }
    expectedPath = existing.data.file_path
  }

  const path = vaultBookPdfPath(productId)
  const prepared = await session.from('evo_vault_book_pdf_uploads').insert({
    vault_product_id: productId,
    storage_path: path,
    expected_file_path: expectedPath,
    target_asset_id: assetId,
  }).select('id').single()
  if (prepared.error || !prepared.data) return { error: 'The PDF upload could not be prepared. Please try again.' }
  return { uploadId: prepared.data.id as string, path, bucket: VAULT_BOOK_PDF_BUCKET }
}

export async function finalizeVaultBookPdfUploadAction(productId: string, uploadId: string, proposedPath: string, validatedSize: number, title: string): Promise<BookPdfActionState> {
  await requireAdmin()
  const cleanTitle = validTitle(title)
  const session = await createClient()
  const book = await loadBook(session, productId)
  const upload = await claimUpload(session, uploadId, productId)
  if (!book || !upload) return { error: 'This prepared PDF upload is unavailable or expired.' }

  const trustedPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, upload.storage_path, productId)
  if (!cleanTitle || !trustedPath || proposedPath !== trustedPath || !Number.isSafeInteger(validatedSize) || validatedSize <= 0 || validatedSize > VAULT_BOOK_PDF_MAX_BYTES) {
    const cleaned = trustedPath ? await removeManagedObject(trustedPath, productId) : false
    return { error: cleaned ? 'The PDF title, path, or size is invalid; the prepared upload was removed.' : 'The PDF title, path, or size is invalid, and cleanup may require administrator attention.' }
  }

  const service = createServiceRoleClient()
  const object = await service.storage.from(VAULT_BOOK_PDF_BUCKET).info(trustedPath)
  const actualSize = object.data?.size
  if (object.error || !Number.isSafeInteger(actualSize) || !actualSize || actualSize > VAULT_BOOK_PDF_MAX_BYTES || actualSize !== validatedSize || object.data?.contentType !== 'application/pdf') {
    const cleaned = await removeManagedObject(trustedPath, productId)
    return { error: cleaned ? 'Storage could not verify the uploaded PDF; the upload was removed.' : 'Storage could not verify the uploaded PDF, and cleanup may require administrator attention.' }
  }

  const finalized = await service.rpc('finalize_evo_vault_book_asset_upload', {
    p_product_id: productId,
    p_asset_id: upload.target_asset_id,
    p_title: cleanTitle,
    p_file_path: trustedPath,
    p_file_size: actualSize,
    p_expected_file_path: upload.expected_file_path,
  })
  if (finalized.error) {
    const cleaned = await removeManagedObject(trustedPath, productId)
    return { error: cleaned ? 'The PDF could not be attached. Existing files were preserved and the new upload was removed.' : 'The PDF could not be attached. Existing files were preserved, but cleanup may require administrator attention.' }
  }

  refreshEditor(productId)
  const previousPath = (finalized.data as { previous_file_path?: unknown } | null)?.previous_file_path
  if (typeof previousPath === 'string' && previousPath !== trustedPath && !(await removeManagedObject(previousPath, productId))) {
    return { success: 'PDF replaced.', warning: 'The previous managed PDF could not be deleted; manual cleanup may be required.' }
  }
  return { success: upload.target_asset_id ? 'PDF replaced.' : 'PDF added.' }
}

export async function abortVaultBookPdfUploadAction(productId: string, uploadId: string): Promise<BookPdfActionState> {
  await requireAdmin()
  const session = await createClient()
  const upload = await claimUpload(session, uploadId, productId)
  if (!upload) return { error: 'The prepared upload could not be found for cleanup.' }
  return await removeManagedObject(upload.storage_path, productId)
    ? { success: 'The unattached upload was removed.' }
    : { warning: 'The unattached upload could not be removed; manual cleanup may be required.' }
}

export async function mutateVaultBookAssetAction(productId: string, assetId: string, operation: string, title?: string): Promise<BookPdfActionState> {
  await requireAdmin()
  if (!UUID.test(productId) || !UUID.test(assetId) || !['rename', 'primary', 'up', 'down', 'remove'].includes(operation)) {
    return { error: 'This PDF change is invalid.' }
  }
  const cleanTitle = operation === 'rename' ? validTitle(title ?? '') : null
  if (operation === 'rename' && !cleanTitle) return { error: `PDF titles are required and must be ${TITLE_MAX} characters or fewer.` }
  const session = await createClient()
  if (!(await loadBook(session, productId))) return { error: 'This book product is unavailable.' }

  const result = await createServiceRoleClient().rpc('mutate_evo_vault_book_asset', {
    p_product_id: productId,
    p_asset_id: assetId,
    p_operation: operation,
    p_title: cleanTitle,
  })
  if (result.error) return { error: 'The PDF change could not be saved. Refresh and try again.' }
  refreshEditor(productId)

  if (operation === 'remove') {
    const removedPath = (result.data as { removed_file_path?: unknown } | null)?.removed_file_path
    if (typeof removedPath === 'string' && !(await removeManagedObject(removedPath, productId))) {
      return { success: 'PDF removed.', warning: 'Its managed Storage object could not be deleted; manual cleanup may be required.' }
    }
  }
  const messages: Record<string, string> = { rename: 'PDF title saved.', primary: 'Primary PDF changed.', up: 'PDF moved up.', down: 'PDF moved down.', remove: 'PDF removed.' }
  return { success: messages[operation] }
}
