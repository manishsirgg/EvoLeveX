import { parseSupportedCurrency, type SupportedCurrency } from './currency.ts'

export type StorePublicationTarget = 'draft' | 'published' | 'archived'
export type StoreAdminActionState = {
  success?: string
  error?: string
  warning?: string
  fields?: Record<string, string>
}

export const initialStoreAdminActionState: StoreAdminActionState = {}

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
