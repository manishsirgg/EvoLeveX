import { isSupportedCurrency, type SupportedCurrency } from './currency.ts'

const CURRENCY_PRECISION: Record<SupportedCurrency, 0 | 2> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  CAD: 2,
  AUD: 2,
  NZD: 2,
  SGD: 2,
  AED: 2,
  JPY: 0,
}

export function toRazorpaySubunits(amount: string, currency: string) {
  if (!isSupportedCurrency(currency)) throw new Error('Unsupported currency')
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) throw new Error('Invalid decimal amount')

  const precision = CURRENCY_PRECISION[currency]
  const [whole, fraction = ''] = amount.split('.')
  if (precision === 0 && /[1-9]/.test(fraction)) {
    throw new Error('Zero-decimal currency amount must be integral')
  }
  if (precision === 0) {
    const subunits = Number(whole)
    if (!Number.isSafeInteger(subunits) || subunits <= 0) {
      throw new Error('Amount is outside the supported range')
    }
    return subunits
  }
  if (fraction.length > precision) throw new Error('Amount has excess decimal precision')

  const digits = `${whole}${fraction.padEnd(precision, '0')}`.replace(/^0+(?=\d)/, '')
  const subunits = Number(digits)
  if (!Number.isSafeInteger(subunits) || subunits <= 0) {
    throw new Error('Amount is outside the supported range')
  }
  return subunits
}
