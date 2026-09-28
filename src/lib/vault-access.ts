import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { ownedVaultBookPdfPath, VAULT_BOOK_PDF_BUCKET } from '@/lib/vault-book-pdf'

const DIGITAL_PRODUCT_MODES = ['digital', 'both'] as const

type AccessRow = {
  id: string
  vault_product_id: string
  granted_at: string
}

type LibraryProductRow = {
  id: string
  name: string
  slug: string
  cover_image_url: string | null
  product_mode: string
}

type LibraryBookRow = { vault_product_id: string; author_name: string | null }

export type VaultLibraryBook = {
  productId: string
  name: string
  slug: string
  coverImageUrl: string | null
  authorName: string | null
  grantedAt: string
}

export type DeliverableVaultBook = {
  accessId: string
  productId: string
  name: string
  filePath: string
}

/** Applies the canonical, user-bound Vault entitlement predicate to a query. */
function activeVaultAccess(query: any, userId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return query
    .eq('user_id', userId)
    .eq('source', 'evo_vault')
    .eq('status', 'active')
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
}

export async function userOwnsVaultProduct(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
) {
  const { data, error } = await activeVaultAccess(
    supabase.from('digital_access').select('id'),
    userId,
  ).eq('vault_product_id', productId).limit(1).maybeSingle()

  return !error && Boolean(data)
}

/**
 * Loads display-only library records. The service client is used only for the
 * safe product projections so a delisted title remains visible to its owner;
 * entitlement selection remains bound to the authenticated RLS client.
 */
export async function getVaultLibrary(supabase: SupabaseClient, userId: string) {
  const { data, error } = await activeVaultAccess(
    supabase.from('digital_access').select('id,vault_product_id,granted_at'),
    userId,
  ).not('vault_product_id', 'is', null).order('granted_at', { ascending: false })

  if (error) return { books: [] as VaultLibraryBook[], hasError: true }
  const accesses = (data ?? []) as AccessRow[]
  if (accesses.length === 0) return { books: [] as VaultLibraryBook[], hasError: false }

  const ids = accesses.map((access) => access.vault_product_id)
  const infrastructure = createServiceRoleClient()
  const [productsResult, booksResult] = await Promise.all([
    infrastructure.from('evo_vault_products')
      .select('id,name,slug,cover_image_url,product_mode')
      .in('id', ids).eq('kind', 'book').in('product_mode', [...DIGITAL_PRODUCT_MODES]),
    infrastructure.from('evo_vault_books')
      .select('vault_product_id,author_name').in('vault_product_id', ids),
  ])
  if (productsResult.error || booksResult.error) {
    return { books: [] as VaultLibraryBook[], hasError: true }
  }

  const products = new Map(((productsResult.data ?? []) as LibraryProductRow[])
    .map((product) => [product.id, product]))
  const books = new Map(((booksResult.data ?? []) as LibraryBookRow[])
    .map((book) => [book.vault_product_id, book]))

  return {
    hasError: false,
    books: accesses.flatMap((access): VaultLibraryBook[] => {
      const product = products.get(access.vault_product_id)
      const book = books.get(access.vault_product_id)
      if (!product || !book) return []
      return [{
        productId: product.id,
        name: product.name,
        slug: product.slug,
        coverImageUrl: product.cover_image_url,
        authorName: book.author_name,
        grantedAt: access.granted_at,
      }]
    }),
  }
}

/** Resolves private delivery data only after the authenticated entitlement check. */
export async function getDeliverableVaultBook(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
): Promise<DeliverableVaultBook | null> {
  const accessResult = await activeVaultAccess(
    supabase.from('digital_access').select('id,vault_product_id,granted_at'),
    userId,
  ).eq('vault_product_id', productId).limit(1).maybeSingle()
  const access = accessResult.data as AccessRow | null
  if (accessResult.error || !access) return null

  const infrastructure = createServiceRoleClient()
  const [productResult, bookResult] = await Promise.all([
    infrastructure.from('evo_vault_products').select('id,name,kind,product_mode')
      .eq('id', productId).eq('kind', 'book').in('product_mode', [...DIGITAL_PRODUCT_MODES]).maybeSingle(),
    infrastructure.from('evo_vault_books').select('vault_product_id,digital_file_path,digital_file_size')
      .eq('vault_product_id', productId).maybeSingle(),
  ])
  const product = productResult.data
  const book = bookResult.data
  if (productResult.error || bookResult.error || !product || !book
    || typeof book.digital_file_path !== 'string' || !book.digital_file_path.trim()
    || typeof book.digital_file_size !== 'number' || book.digital_file_size <= 0) return null

  const filePath = ownedVaultBookPdfPath(VAULT_BOOK_PDF_BUCKET, book.digital_file_path, product.id)
  if (!filePath) return null
  return { accessId: access.id, productId: product.id, name: product.name, filePath }
}
