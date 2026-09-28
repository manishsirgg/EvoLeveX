import { isSupportedCurrency, type SupportedCurrency } from './currency.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDER_ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const PROVIDER_PAYMENT_ID = /^pay_[A-Za-z0-9]{8,64}$/
const CHECKOUT_SIGNATURE = /^[a-fA-F0-9]{64}$/
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/

export type TrustedVaultOrder = {
  orderId: string
  orderStatus: 'pending'
  paymentStatus: 'pending'
  currency: SupportedCurrency
  totalAmount: string
  created: boolean
}

export type TrustedProviderOrder = {
  orderId: string
  paymentId: string
  providerOrderId: string
  amount: number
  currency: SupportedCurrency
  keyId: string
}

export type TrustedCheckoutCallback = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

function decimalPlaces(currency: SupportedCurrency) {
  return currency === 'JPY' ? 0 : 2
}

export function normalizeMoneyAmount(value: unknown, currency: SupportedCurrency): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const source = String(value).trim()
  const match = DECIMAL.exec(source)
  if (!match) return null

  const places = decimalPlaces(currency)
  const fraction = match[1] ?? ''
  if (fraction.length > places && /[1-9]/.test(fraction.slice(places))) return null

  const whole = BigInt(source.split('.')[0]).toString()
  if (places === 0) return whole
  return `${whole}.${fraction.slice(0, places).padEnd(places, '0')}`
}

export function formatTrustedMoney(amount: unknown, currency: SupportedCurrency): string | null {
  const normalized = normalizeMoneyAmount(amount, currency)
  return normalized === null ? null : `${currency} ${normalized}`
}

export function pricesMatch(
  first: { amount: unknown; currency: unknown },
  second: { amount: unknown; currency: unknown },
) {
  if (!isSupportedCurrency(first.currency) || !isSupportedCurrency(second.currency)
    || first.currency !== second.currency) return false
  const firstAmount = normalizeMoneyAmount(first.amount, first.currency)
  const secondAmount = normalizeMoneyAmount(second.amount, second.currency)
  return firstAmount !== null && firstAmount === secondAmount
}

export function parseVaultOrderResponse(value: unknown): TrustedVaultOrder | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const order = value as Record<string, unknown>
  if (typeof order.orderId !== 'string' || !UUID.test(order.orderId)
    || order.orderStatus !== 'pending' || order.paymentStatus !== 'pending'
    || !isSupportedCurrency(order.currency) || typeof order.created !== 'boolean') return null
  const totalAmount = normalizeMoneyAmount(order.totalAmount, order.currency)
  if (totalAmount === null || BigInt(totalAmount.replace('.', '')) <= BigInt(0)) return null
  return { ...order, totalAmount } as TrustedVaultOrder
}

export function parseProviderOrderResponse(value: unknown): TrustedProviderOrder | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const order = value as Record<string, unknown>
  if (typeof order.orderId !== 'string' || !UUID.test(order.orderId)
    || typeof order.paymentId !== 'string' || !UUID.test(order.paymentId)
    || typeof order.providerOrderId !== 'string' || !PROVIDER_ORDER_ID.test(order.providerOrderId)
    || typeof order.amount !== 'number' || !Number.isSafeInteger(order.amount) || order.amount <= 0
    || !isSupportedCurrency(order.currency)
    || typeof order.keyId !== 'string' || !order.keyId.trim()) return null
  return order as TrustedProviderOrder
}

export function isTrustedCheckoutCallback(value: unknown): value is TrustedCheckoutCallback {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const callback = value as Record<string, unknown>
  return typeof callback.razorpay_order_id === 'string'
    && PROVIDER_ORDER_ID.test(callback.razorpay_order_id)
    && typeof callback.razorpay_payment_id === 'string'
    && PROVIDER_PAYMENT_ID.test(callback.razorpay_payment_id)
    && typeof callback.razorpay_signature === 'string'
    && CHECKOUT_SIGNATURE.test(callback.razorpay_signature)
}
