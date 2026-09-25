export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'JPY', name: 'Japanese Yen' },
] as const

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number]['code']

export const DEFAULT_CURRENCY: SupportedCurrency = 'USD'

export function normalizeCurrency(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === 'string' && SUPPORTED_CURRENCIES.some((currency) => currency.code === value)
}

export function parseSupportedCurrency(value: unknown): SupportedCurrency | null {
  const normalized = normalizeCurrency(value)
  return isSupportedCurrency(normalized) ? normalized : null
}

export function formatMoney(amount: number | string, currency: SupportedCurrency): string {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  try {
    if (!Number.isFinite(numericAmount)) throw new RangeError('Amount must be finite')
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(numericAmount)
  } catch {
    return `${currency} ${String(amount)}`
  }
}
