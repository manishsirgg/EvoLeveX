import { parseSupportedCurrency, type SupportedCurrency } from './currency.ts'

export type StorePublicationTarget = 'draft' | 'published' | 'archived'
export type StoreAdminActionState = {
  success?: string
  error?: string
  warning?: string
  fields?: Record<string, string>
}

export const initialStoreAdminActionState: StoreAdminActionState = {}

export type StoreCategoryMutation = {
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export type StoreProductMutation = {
  name: string
  slug: string
  category_id: string | null
  description: string | null
  short_description: string | null
  is_featured: boolean
  sort_order: number
  seo_title: string | null
  seo_description: string | null
}

export type StoreProductValidationResult =
  | { success: true; data: StoreProductMutation }
  | { success: false; state: StoreAdminActionState }

export type StoreCategoryValidationResult =
  | { success: true; data: StoreCategoryMutation }
  | { success: false; state: StoreAdminActionState }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{0,63}$/
const OPTION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{0,31}$/
const INTEGER_PATTERN = /^-?(?:0|[1-9][0-9]*)$/
// numeric(14,2): at most twelve integral digits and, when present, one or two decimals.
const MONEY_PATTERN = /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/

export function isStoreUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function normalizeStoreSlug(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    : ''
}

export function isStoreSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 120 && SLUG_PATTERN.test(value)
}

export function normalizeStoreSku(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

export function isStoreSku(value: unknown): value is string {
  return typeof value === 'string' && SKU_PATTERN.test(value)
}

export function normalizeStoreOptionCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return normalized || null
}

export function isStoreSizeCode(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && OPTION_CODE_PATTERN.test(value))
}

export const isStoreColorCode = isStoreSizeCode

export function parseStoreSafeInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!INTEGER_PATTERN.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function parseStoreSortOrder(value: unknown): number | null {
  const parsed = parseStoreSafeInteger(value)
  return parsed !== null && parsed >= 0 ? parsed : null
}

function categoryFieldValue(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Converts untrusted category form values into the complete, explicit database
 * payload. No other client-supplied keys can pass through this boundary.
 */
export function parseStoreCategoryMutation(input: Record<string, unknown>): StoreCategoryValidationResult {
  const name = categoryFieldValue(input, 'name')
  const slug = normalizeStoreSlug(input.slug)
  const description = categoryFieldValue(input, 'description') || null
  const sortOrder = parseStoreSortOrder(input.sort_order)
  const fields = {
    name,
    slug,
    description: description ?? '',
    sort_order: categoryFieldValue(input, 'sort_order'),
    is_active: input.is_active === 'on' ? 'on' : '',
  }

  if (!name) return { success: false, state: { error: 'Category name is required.', fields } }
  if (!isStoreSlug(slug)) {
    return {
      success: false,
      state: { error: 'Enter a name or slug that produces a valid URL slug of 120 characters or fewer.', fields },
    }
  }
  if (sortOrder === null) {
    return { success: false, state: { error: 'Sort order must be a non-negative whole number.', fields } }
  }

  return {
    success: true,
    data: { name, slug, description, sort_order: sortOrder, is_active: input.is_active === 'on' },
  }
}

/** Builds the exact product-core persistence whitelist from untrusted form input. */
export function parseStoreProductMutation(input: Record<string, unknown>): StoreProductValidationResult {
  const text = (key: string) => typeof input[key] === 'string' ? input[key].trim() : ''
  const name = text('name')
  const slug = normalizeStoreSlug(input.slug)
  const categoryValue = text('category_id')
  const categoryId = categoryValue || null
  const sortOrder = parseStoreSortOrder(input.sort_order)
  const fields = {
    name,
    slug,
    category_id: categoryValue,
    description: text('description'),
    short_description: text('short_description'),
    is_featured: input.is_featured === 'on' ? 'on' : '',
    sort_order: text('sort_order'),
    seo_title: text('seo_title'),
    seo_description: text('seo_description'),
  }

  if (!name) return { success: false, state: { error: 'Product name is required.', fields } }
  if (!isStoreSlug(slug)) return { success: false, state: { error: 'Enter a valid URL slug of 120 characters or fewer.', fields } }
  if (categoryId !== null && !isStoreUuid(categoryId)) return { success: false, state: { error: 'Select a valid category or leave it unassigned.', fields } }
  if (sortOrder === null) return { success: false, state: { error: 'Sort order must be a non-negative whole number.', fields } }

  return { success: true, data: {
    name,
    slug,
    category_id: categoryId,
    description: fields.description || null,
    short_description: fields.short_description || null,
    is_featured: input.is_featured === 'on',
    sort_order: sortOrder,
    seo_title: fields.seo_title || null,
    seo_description: fields.seo_description || null,
  } }
}

export function parseStoreWeightGrams(value: unknown): number | null {
  const parsed = parseStoreSafeInteger(value)
  return parsed !== null && parsed > 0 ? parsed : null
}

export function parseStoreCurrency(value: unknown): SupportedCurrency | null {
  return parseSupportedCurrency(value)
}

/** Validates a database-ready decimal string without converting it to a number. */
export function isExactStoreMoney(value: unknown, currency?: SupportedCurrency): value is string {
  if (typeof value !== 'string' || !MONEY_PATTERN.test(value)) return false
  return currency !== 'JPY' || !value.includes('.')
}

export function parseStoreMoney(value: unknown, currency?: SupportedCurrency): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return isExactStoreMoney(normalized, currency) ? normalized : null
}

export function parseStorePublicationTarget(value: unknown): StorePublicationTarget | null {
  return value === 'draft' || value === 'published' || value === 'archived' ? value : null
}

/** Archived products are terminal in the V1 admin application. */
export function canTransitionStorePublication(
  current: StorePublicationTarget,
  target: StorePublicationTarget,
): boolean {
  return current !== 'archived' || target === 'archived'
}
