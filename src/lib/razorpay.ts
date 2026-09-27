import 'server-only'

const ORDER_ENDPOINT = 'https://api.razorpay.com/v1/orders'
const REQUEST_TIMEOUT_MS = 10_000
const PROVIDER_ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/

const CURRENCY_PRECISION = {
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
} as const

export type SupportedCurrency = keyof typeof CURRENCY_PRECISION

export class RazorpayRequestError extends Error {
  constructor(public readonly ambiguous: boolean) {
    super(ambiguous ? 'Razorpay request outcome is ambiguous' : 'Razorpay rejected the order')
    this.name = 'RazorpayRequestError'
  }
}

export function toRazorpaySubunits(amount: string, currency: string) {
  if (!(currency in CURRENCY_PRECISION)) throw new Error('Unsupported currency')
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) throw new Error('Invalid decimal amount')

  const precision = CURRENCY_PRECISION[currency as SupportedCurrency]
  const [whole, fraction = ''] = amount.split('.')
  if (fraction.length > precision) throw new Error('Amount has excess decimal precision')

  const digits = `${whole}${fraction.padEnd(precision, '0')}`.replace(/^0+(?=\d)/, '')
  const subunits = Number(digits)
  if (!Number.isSafeInteger(subunits) || subunits <= 0) throw new Error('Amount is outside the supported range')
  return subunits
}

export function razorpayReceipt(paymentId: string) {
  // "evx_" plus a UUID is exactly Razorpay's 40-character receipt limit.
  return `evx_${paymentId}`
}

type CreateOrderInput = {
  amount: number
  currency: SupportedCurrency
  receipt: string
  orderId: string
  paymentId: string
}

export async function createRazorpayOrder(input: CreateOrderInput) {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new RazorpayRequestError(false)

  let response: Response
  try {
    response = await fetch(ORDER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        notes: { local_order_id: input.orderId, local_payment_id: input.paymentId },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    // A transport failure may have happened after Razorpay accepted the order; never retry here.
    throw new RazorpayRequestError(true)
  }

  if (!response.ok) throw new RazorpayRequestError(false)

  let value: unknown
  try {
    value = await response.json()
  } catch {
    // Razorpay accepted the request, but the response cannot be reconciled safely.
    throw new RazorpayRequestError(true)
  }
  if (!value || typeof value !== 'object') throw new RazorpayRequestError(true)

  const order = value as Record<string, unknown>
  if (!PROVIDER_ORDER_ID.test(String(order.id ?? ''))
    || order.amount !== input.amount
    || order.currency !== input.currency
    || order.receipt !== input.receipt) {
    throw new RazorpayRequestError(true)
  }

  return { id: order.id as string }
}
