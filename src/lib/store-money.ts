import type { SupportedCurrency } from '@/lib/currency'

const DECIMAL = /^(0|[1-9]\d*)(?:\.(\d+))?$/
// PostgreSQL numeric(14,2): twelve major-unit digits and two fractional digits.
const MAX_MAJOR = BigInt('999999999999')
export const STORE_CURRENCY_SCALE: Record<SupportedCurrency, 0 | 2> = {
  JPY: 0, USD: 2, EUR: 2, GBP: 2, INR: 2, CAD: 2, AUD: 2, NZD: 2, SGD: 2, AED: 2,
}

export function storeAmountToMinor(value: unknown, currency: SupportedCurrency): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value)
  const match = DECIMAL.exec(text)
  if (!match) return null
  const scale = STORE_CURRENCY_SCALE[currency]
  const fraction = match[2] ?? ''
  if (scale === 0 && fraction && /[1-9]/.test(fraction)) return null
  if (scale === 2 && fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) return null
  const major = BigInt(match[1])
  if (major > MAX_MAJOR) return null
  const minor = scale === 0 ? major : major * BigInt(100) + BigInt((fraction + '00').slice(0, 2))
  return minor
}

export function storeMinorToAmount(minor: bigint, currency: SupportedCurrency): string {
  const scale = STORE_CURRENCY_SCALE[currency]
  if (scale === 0) return minor.toString()
  const absolute = minor < 0 ? -minor : minor
  return `${minor < 0 ? '-' : ''}${absolute / BigInt(100)}.${(absolute % BigInt(100)).toString().padStart(2, '0')}`
}

export function formatStoreMinor(minor: bigint, currency: SupportedCurrency): string {
  const amount = storeMinorToAmount(minor, currency)
  try {
    // The decimal string is authoritative; Number is used only to obtain locale presentation.
    return new Intl.NumberFormat('en', {
      style: 'currency', currency,
      minimumFractionDigits: STORE_CURRENCY_SCALE[currency],
      maximumFractionDigits: STORE_CURRENCY_SCALE[currency],
    }).format(Number(amount))
  } catch {
    return `${currency} ${amount}`
  }
}

export function storeMoney(minor: bigint, currency: SupportedCurrency) {
  return { amount: storeMinorToAmount(minor, currency), formatted: formatStoreMinor(minor, currency) }
}
