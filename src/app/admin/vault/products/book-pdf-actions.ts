'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { logVaultBookAssetFailure } from '@/lib/vault-book-asset-diagnostics'
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
type Operation = 'add' | 'replacement' | 'rename' | 'primary' | 'reordering' | 'removal' | 'abort'

function diagnosticOperation(operation: string): Operation {
  if (operation === 'up' || operation === 'down') return 'reordering'
  if (operation === 'remove') return 'removal'
  return operation as Operation
}

async function authorize(operation: Operation, productId: string, assetId: string | null = null) {
  try {
    return await requireAdmin()
  } catch (error) {
    logVaultBookAssetFailure({ operation, stage: 'authorization/staff verification', productId, assetId, error: error as Error })
    throw error
  }
}

async function loadBook(session: SessionClient, productId: string, operation: Operation, assetId: string | null = null) {
  if (!UUID.test(productId)) return null
  const product = await session.from('evo_vault_products').select('id,kind').eq('id', productId).maybeSingle()
  if (product.error) {
    logVaultBookAssetFailure({ operation, stage: 'book product database lookup', productId, assetId, error: product.error })
    return null
  }
  if (!product.data || product.data.kind !== 'book') return null
  const book = await session.from('evo_vault_books').select('vault_product_id').eq('vault_product_id', productId).maybeSingle()
  if (book.error) logVaultBookAssetFailure({ operation, stage: 'book record database lookup', productId, assetId, error: book.error })
  return book.error || !book.data ? null : book.data
}

async function claimUpload(session: SessionClient, uploadId: string, productId: string, operation: Operation): Promise<UploadRow | null> {
  if (!UUID.test(uploadId) || !UUID.test(productId)) return null
  const upload = await session.from('evo_vault_book_pdf_uploads').delete().eq('id', uploadId).eq('vault_product_id', productId)
    .select('id,vault_product_id,storage_path,expected_file_path,target_asset_id').maybeSingle()
  if (upload.error) logVaultBookAssetFailure({ operation, stage: 'upload-session claim', productId, error: upload.error })
  return upload.error || !upload.data ? null : upload.data as UploadRow
}

async function removeManagedObject(path: string, productId: string, operation: Operation, assetId: string | null, stage: string) {
  const managedPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, path, productId)
  if (!managedPath) return false
  try {
    const cleanup = await createServiceRoleClient().storage.from(VAULT_BOOK_PDF_BUCKET).remove([managedPath])
    if (cleanup.error) logVaultBookAssetFailure({ operation, stage, productId, assetId, error: cleanup.error })
    return !cleanup.error
  } catch (error) {
    logVaultBookAssetFailure({ operation, stage, productId, assetId, error: error as Error })
    return false
  }
}

function refreshEditor(productId: string) {
  revalidatePath(`/admin/vault/products/${productId}/edit`)
}

function validTitle(title: string) {
  const clean = title.trim()
  return clean && clean.length <= TITLE_MAX ? clean : null
}

export async function prepareVaultBookPdfUploadAction(productId: string, assetId: string | null) {
  const operation: Operation = assetId ? 'replacement' : 'add'
  await authorize(operation, productId, assetId)
  try {
    const session = await createClient()
    const book = await loadBook(session, productId, operation, assetId)
    if (!book) {
      logVaultBookAssetFailure({ operation, stage: 'upload-session creation', productId, assetId, error: { message: 'Book lookup failed or returned no book' } })
      return { error: 'This book product is unavailable.' }
    }

    let expectedPath: string | null = null
    if (assetId !== null) {
      if (!UUID.test(assetId)) return { error: 'This PDF asset is invalid.' }
      const existing = await createServiceRoleClient().from('evo_vault_book_assets').select('file_path')
        .eq('id', assetId).eq('vault_product_id', productId).eq('is_active', true).maybeSingle()
      if (existing.error || !existing.data) {
        logVaultBookAssetFailure({ operation, stage: 'upload-session creation', productId, assetId, error: existing.error ?? { message: 'Asset was not found' } })
        return { error: 'This PDF asset is unavailable.' }
      }
      expectedPath = existing.data.file_path
    }

    const path = vaultBookPdfPath(productId)
    const prepared = await session.from('evo_vault_book_pdf_uploads').insert({
      vault_product_id: productId, storage_path: path, expected_file_path: expectedPath, target_asset_id: assetId,
    }).select('id').single()
    if (prepared.error || !prepared.data) {
      logVaultBookAssetFailure({ operation, stage: 'upload-session creation', productId, assetId, error: prepared.error ?? { message: 'Upload session returned no data' } })
      return { error: 'The PDF upload could not be prepared. Please try again.' }
    }
    return { uploadId: prepared.data.id as string, path, bucket: VAULT_BOOK_PDF_BUCKET }
  } catch (error) {
    logVaultBookAssetFailure({ operation, stage: 'unexpected server exception', productId, assetId, error: error as Error })
    return { error: 'The PDF upload could not be prepared. Please try again.' }
  }
}

async function finalizeVaultBookPdfUpload(productId: string, uploadId: string, proposedPath: string, validatedSize: number, title: string): Promise<BookPdfActionState> {
  const cleanTitle = validTitle(title)
  const session = await createClient()
  const book = await loadBook(session, productId, 'add')
  const upload = await claimUpload(session, uploadId, productId, 'add')
  if (!book || !upload) {
    logVaultBookAssetFailure({ operation: 'add', stage: 'upload-session creation', productId, error: { message: 'Prepared upload could not be claimed' } })
    return { error: 'This prepared PDF upload is unavailable or expired.' }
  }
  const operation: Operation = upload.target_asset_id ? 'replacement' : 'add'
  const assetId = upload.target_asset_id

  const trustedPath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, upload.storage_path, productId)
  if (!cleanTitle || !trustedPath || proposedPath !== trustedPath || !Number.isSafeInteger(validatedSize) || validatedSize <= 0 || validatedSize > VAULT_BOOK_PDF_MAX_BYTES) {
    const cleaned = trustedPath ? await removeManagedObject(trustedPath, productId, operation, assetId, 'cleanup after failed finalization') : false
    return { error: cleaned ? 'The PDF title, path, or size is invalid; the prepared upload was removed.' : 'The PDF title, path, or size is invalid, and cleanup may require administrator attention.' }
  }

  const service = createServiceRoleClient()
  const object = await service.storage.from(VAULT_BOOK_PDF_BUCKET).info(trustedPath)
  const actualSize = object.data?.size
  if (object.error || !Number.isSafeInteger(actualSize) || !actualSize || actualSize > VAULT_BOOK_PDF_MAX_BYTES || actualSize !== validatedSize || object.data?.contentType !== 'application/pdf') {
    logVaultBookAssetFailure({ operation, stage: 'uploaded-object verification', productId, assetId, error: object.error ?? { message: 'Uploaded object metadata did not match the validated PDF' } })
    const cleaned = await removeManagedObject(trustedPath, productId, operation, assetId, 'cleanup after failed verification')
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
    logVaultBookAssetFailure({ operation, stage: 'finalize_evo_vault_book_asset_upload RPC', productId, assetId, error: finalized.error })
    const cleaned = await removeManagedObject(trustedPath, productId, operation, assetId, 'cleanup/removal after failed finalization')
    return { error: cleaned ? 'The PDF could not be attached. Existing files were preserved and the new upload was removed.' : 'The PDF could not be attached. Existing files were preserved, but cleanup may require administrator attention.' }
  }

  refreshEditor(productId)
  const previousPath = (finalized.data as { previous_file_path?: unknown } | null)?.previous_file_path
  if (typeof previousPath === 'string' && previousPath !== trustedPath && !(await removeManagedObject(previousPath, productId, operation, assetId, 'replacement previous-object removal'))) {
    return { success: 'PDF replaced.', warning: 'The previous managed PDF could not be deleted; manual cleanup may be required.' }
  }
  return { success: upload.target_asset_id ? 'PDF replaced.' : 'PDF added.' }
}

export async function finalizeVaultBookPdfUploadAction(productId: string, uploadId: string, proposedPath: string, validatedSize: number, title: string): Promise<BookPdfActionState> {
  await authorize('add', productId)
  try {
    return await finalizeVaultBookPdfUpload(productId, uploadId, proposedPath, validatedSize, title)
  } catch (error) {
    logVaultBookAssetFailure({ operation: 'add', stage: 'unexpected server exception', productId, error: error as Error })
    throw error
  }
}

type ReportedUploadError = { code?: string; message?: string; details?: string; hint?: string }

export async function abortVaultBookPdfUploadAction(productId: string, uploadId: string, uploadError?: ReportedUploadError): Promise<BookPdfActionState> {
  await authorize('abort', productId)
  try {
    const session = await createClient()
    const upload = await claimUpload(session, uploadId, productId, 'abort')
    if (!upload) return { error: 'The prepared upload could not be found for cleanup.' }
    const operation = upload.target_asset_id ? 'replacement' : 'add'
    if (uploadError) logVaultBookAssetFailure({ operation, stage: 'Storage upload', productId, assetId: upload.target_asset_id, error: uploadError })
    return await removeManagedObject(upload.storage_path, productId, operation, upload.target_asset_id, 'cleanup/removal of unattached upload')
      ? { success: 'The unattached upload was removed.' }
      : { warning: 'The unattached upload could not be removed; manual cleanup may be required.' }
  } catch (error) {
    logVaultBookAssetFailure({ operation: 'abort', stage: 'unexpected server exception', productId, error: error as Error })
    return { warning: 'The unattached upload could not be removed; manual cleanup may be required.' }
  }
}

export async function mutateVaultBookAssetAction(productId: string, assetId: string, operation: string, title?: string): Promise<BookPdfActionState> {
  const diagnostic = diagnosticOperation(operation)
  await authorize(diagnostic, productId, assetId)
  if (!UUID.test(productId) || !UUID.test(assetId) || !['rename', 'primary', 'up', 'down', 'remove'].includes(operation)) {
    return { error: 'This PDF change is invalid.' }
  }
  const cleanTitle = operation === 'rename' ? validTitle(title ?? '') : null
  if (operation === 'rename' && !cleanTitle) return { error: `PDF titles are required and must be ${TITLE_MAX} characters or fewer.` }
  try {
    const session = await createClient()
    if (!(await loadBook(session, productId, diagnostic, assetId))) return { error: 'This book product is unavailable.' }

    const result = await createServiceRoleClient().rpc('mutate_evo_vault_book_asset', {
      p_product_id: productId, p_asset_id: assetId, p_operation: operation, p_title: cleanTitle,
    })
    if (result.error) {
      logVaultBookAssetFailure({ operation: diagnostic, stage: 'mutate_evo_vault_book_asset RPC', productId, assetId, error: result.error })
      if (result.error.message === 'EVO_VAULT_PUBLICATION_READINESS_REQUIRED') {
        return { error: 'An active digital book must keep at least one PDF. Deactivate the book first or add another PDF.' }
      }
      return { error: 'The PDF change could not be saved. Refresh and try again.' }
    }
    refreshEditor(productId)

    if (operation === 'remove') {
      const removedPath = (result.data as { removed_file_path?: unknown } | null)?.removed_file_path
      if (typeof removedPath === 'string' && !(await removeManagedObject(removedPath, productId, 'removal', assetId, 'removed-object cleanup'))) {
        return { success: 'PDF removed.', warning: 'Its managed Storage object could not be deleted; manual cleanup may be required.' }
      }
    }
    const messages: Record<string, string> = { rename: 'PDF title saved.', primary: 'Primary PDF changed.', up: 'PDF moved up.', down: 'PDF moved down.', remove: 'PDF removed.' }
    return { success: messages[operation] }
  } catch (error) {
    logVaultBookAssetFailure({ operation: diagnostic, stage: 'unexpected server exception', productId, assetId, error: error as Error })
    return { error: 'The PDF change could not be saved. Refresh and try again.' }
  }
}
