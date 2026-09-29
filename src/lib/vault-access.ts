import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { ProductMode } from '@/lib/admin-vault-validation'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { safeVaultDiagnosticField } from '@/lib/vault-book-asset-diagnostics'
import { ownedVaultBookPdfPath, VAULT_BOOK_PDF_BUCKET } from '@/lib/vault-book-pdf'

const DIGITAL_PRODUCT_MODES = ['digital', 'hybrid'] as const satisfies readonly ProductMode[]

type VaultQueryError = { code?: string; message: string; details?: string; hint?: string }
type QueryStage = 'entitlement' | 'products' | 'books' | 'assets'

function logVaultQueryFailure(
  event: 'Vault library query failed' | 'Vault delivery query failed',
  stage: QueryStage,
  error: VaultQueryError,
  context: { userId: string; productIds: string[]; assetId?: string },
) {
  console.error(event, { stage, code: error.code,
    message: safeVaultDiagnosticField(error.message), details: safeVaultDiagnosticField(error.details),
    hint: safeVaultDiagnosticField(error.hint), ...context })
}

type AccessRow = { id: string; vault_product_id: string; granted_at: string }
type LibraryProductRow = { id: string; name: string; slug: string; cover_image_url: string | null; product_mode: string }
type LibraryBookRow = {
  vault_product_id: string
  author_name: string | null
  digital_file_path: string | null
  digital_file_size: number | null
}
type AssetRow = {
  id: string
  vault_product_id: string
  title: string
  file_path: string
  file_size: number
  mime_type: string
  sort_order: number
  is_primary: boolean
  is_active: boolean
  created_at: string
}

export type VaultLibraryAsset = {
  assetId: string | null
  title: string
  fileSize: number
  isPrimary: boolean
  /** Present only for the narrow, no-normalized-assets compatibility path. */
  legacyProductId?: string
}

export type VaultLibraryBook = {
  productId: string
  name: string
  slug: string
  coverImageUrl: string | null
  authorName: string | null
  grantedAt: string
  assets: VaultLibraryAsset[]
}

export type DeliverableVaultAsset = {
  accessId: string
  assetId: string | null
  productId: string
  productName: string
  assetTitle: string
  filePath: string
}

/** Applies the canonical, user-bound Vault entitlement predicate to a query. */
function activeVaultAccess(query: any, userId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return query.eq('user_id', userId).eq('source', 'evo_vault').eq('status', 'active')
    .is('revoked_at', null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
}

export async function userOwnsVaultProduct(supabase: SupabaseClient, userId: string, productId: string) {
  const { data, error } = await activeVaultAccess(
    supabase.from('digital_access').select('id'), userId,
  ).eq('vault_product_id', productId).limit(1).maybeSingle()
  return !error && Boolean(data)
}

/**
 * Resolves ownership with the user's RLS client, then reads catalog and asset
 * projections with the trusted client. Private paths never leave this module.
 */
export async function getVaultLibrary(supabase: SupabaseClient, userId: string) {
  const { data, error } = await activeVaultAccess(
    supabase.from('digital_access').select('id,vault_product_id,granted_at'), userId,
  ).not('vault_product_id', 'is', null).order('granted_at', { ascending: false })
  if (error) {
    logVaultQueryFailure('Vault library query failed', 'entitlement', error, { userId, productIds: [] })
    return { books: [] as VaultLibraryBook[], hasError: true }
  }
  const accesses = (data ?? []) as AccessRow[]
  if (accesses.length === 0) return { books: [] as VaultLibraryBook[], hasError: false }

  const ids = accesses.map((access) => access.vault_product_id)
  const infrastructure = createServiceRoleClient()
  const [productsResult, booksResult, assetsResult] = await Promise.all([
    infrastructure.from('evo_vault_products').select('id,name,slug,cover_image_url,product_mode')
      .in('id', ids).eq('kind', 'book').in('product_mode', [...DIGITAL_PRODUCT_MODES]),
    infrastructure.from('evo_vault_books')
      .select('vault_product_id,author_name,digital_file_path,digital_file_size').in('vault_product_id', ids),
    infrastructure.from('evo_vault_book_assets')
      .select('id,vault_product_id,title,file_size,is_primary,sort_order,created_at')
      .in('vault_product_id', ids).eq('is_active', true)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }),
  ])
  for (const [stage, result] of [['products', productsResult], ['books', booksResult], ['assets', assetsResult]] as const) {
    if (result.error) logVaultQueryFailure('Vault library query failed', stage, result.error, { userId, productIds: ids })
  }
  if (productsResult.error || booksResult.error || assetsResult.error) {
    return { books: [] as VaultLibraryBook[], hasError: true }
  }

  const products = new Map(((productsResult.data ?? []) as LibraryProductRow[]).map((row) => [row.id, row]))
  const books = new Map(((booksResult.data ?? []) as LibraryBookRow[]).map((row) => [row.vault_product_id, row]))
  const assetsByProduct = new Map<string, VaultLibraryAsset[]>()
  for (const asset of (assetsResult.data ?? []) as Pick<AssetRow, 'id' | 'vault_product_id' | 'title' | 'file_size' | 'is_primary'>[]) {
    const safeAsset = { assetId: asset.id, title: asset.title, fileSize: asset.file_size, isPrimary: asset.is_primary }
    assetsByProduct.set(asset.vault_product_id, [...(assetsByProduct.get(asset.vault_product_id) ?? []), safeAsset])
  }

  return {
    hasError: false,
    books: accesses.flatMap((access): VaultLibraryBook[] => {
      const product = products.get(access.vault_product_id)
      const book = books.get(access.vault_product_id)
      if (!product || !book) return []
      let assets = assetsByProduct.get(product.id) ?? []
      // Never mix the compatibility representation with normalized assets.
      if (assets.length === 0 && typeof book.digital_file_path === 'string' && book.digital_file_path.trim()
        && typeof book.digital_file_size === 'number' && book.digital_file_size > 0
        && ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, book.digital_file_path, product.id)) {
        assets = [{ assetId: null, legacyProductId: product.id, title: 'Book PDF',
          fileSize: book.digital_file_size, isPrimary: true }]
      }
      return [{ productId: product.id, name: product.name, slug: product.slug,
        coverImageUrl: product.cover_image_url, authorName: book.author_name,
        grantedAt: access.granted_at, assets }]
    }),
  }
}

async function eligibleProductAndBook(
  userId: string,
  productId: string,
  assetId?: string,
) {
  const infrastructure = createServiceRoleClient()
  const [productResult, bookResult] = await Promise.all([
    infrastructure.from('evo_vault_products').select('id,name,kind,product_mode')
      .eq('id', productId).eq('kind', 'book').in('product_mode', [...DIGITAL_PRODUCT_MODES]).maybeSingle(),
    infrastructure.from('evo_vault_books').select('vault_product_id,digital_file_path,digital_file_size')
      .eq('vault_product_id', productId).maybeSingle(),
  ])
  if (productResult.error) logVaultQueryFailure('Vault delivery query failed', 'products', productResult.error,
    { userId, productIds: [productId], assetId })
  if (bookResult.error) logVaultQueryFailure('Vault delivery query failed', 'books', bookResult.error,
    { userId, productIds: [productId], assetId })
  if (productResult.error || bookResult.error || !productResult.data || !bookResult.data) return null
  return { product: productResult.data, book: bookResult.data }
}

/** Loads an active asset first, derives its product, then proves exact product ownership and eligibility. */
export async function getDeliverableVaultAsset(
  supabase: SupabaseClient,
  userId: string,
  assetId: string,
): Promise<DeliverableVaultAsset | null> {
  const infrastructure = createServiceRoleClient()
  const assetResult = await infrastructure.from('evo_vault_book_assets')
    .select('id,vault_product_id,title,file_path,file_size,mime_type,sort_order,is_primary,is_active,created_at')
    .eq('id', assetId).eq('is_active', true).maybeSingle()
  if (assetResult.error) {
    logVaultQueryFailure('Vault delivery query failed', 'assets', assetResult.error,
      { userId, productIds: [], assetId })
    return null
  }
  const asset = assetResult.data as AssetRow | null
  if (!asset || asset.mime_type !== 'application/pdf' || asset.file_size <= 0) return null
  const filePath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, asset.file_path, asset.vault_product_id)
  if (!filePath) return null

  const accessResult = await activeVaultAccess(
    supabase.from('digital_access').select('id,vault_product_id,granted_at'), userId,
  ).eq('vault_product_id', asset.vault_product_id).limit(1).maybeSingle()
  if (accessResult.error) {
    logVaultQueryFailure('Vault delivery query failed', 'entitlement', accessResult.error,
      { userId, productIds: [asset.vault_product_id], assetId })
    return null
  }
  const access = accessResult.data as AccessRow | null
  if (!access) return null
  const eligible = await eligibleProductAndBook(userId, asset.vault_product_id, assetId)
  if (!eligible) return null
  return { accessId: access.id, assetId: asset.id, productId: asset.vault_product_id,
    productName: eligible.product.name, assetTitle: asset.title, filePath }
}

/** Narrow compatibility resolver used only when a book has no active normalized asset. */
export async function getDeliverableLegacyVaultBook(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
): Promise<DeliverableVaultAsset | null> {
  const infrastructure = createServiceRoleClient()
  const activeAssets = await infrastructure.from('evo_vault_book_assets').select('id')
    .eq('vault_product_id', productId).eq('is_active', true).limit(1)
  if (activeAssets.error || (activeAssets.data?.length ?? 0) > 0) return null
  const accessResult = await activeVaultAccess(
    supabase.from('digital_access').select('id,vault_product_id,granted_at'), userId,
  ).eq('vault_product_id', productId).limit(1).maybeSingle()
  const access = accessResult.data as AccessRow | null
  if (accessResult.error || !access) return null
  const eligible = await eligibleProductAndBook(userId, productId)
  const path = eligible && typeof eligible.book.digital_file_path === 'string'
    ? ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, eligible.book.digital_file_path, productId) : null
  if (!eligible || !path || typeof eligible.book.digital_file_size !== 'number'
    || eligible.book.digital_file_size <= 0) return null
  return { accessId: access.id, assetId: null, productId, productName: eligible.product.name,
    assetTitle: 'Book PDF', filePath: path }
}
