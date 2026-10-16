import { toRazorpaySubunits } from './razorpay-money.ts'

/** Reject imprecise JSON numbers instead of rounding a financial amount. */
export function parseTrustedStoreAmount(value: unknown, currency: string): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,11})\.\d{2}$/.test(value)) {
    throw new Error('STORE_PROVIDER_AMOUNT_NOT_EXACT_DECIMAL')
  }
  // Validate minor-unit precision, positive range, and JPY zero-decimal constraints.
  toRazorpaySubunits(value, currency)
  return value
}
