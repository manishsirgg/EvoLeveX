const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDER_ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const PROVIDER_PAYMENT_ID = /^pay_[A-Za-z0-9]{8,64}$/
const CHECKOUT_SIGNATURE = /^[a-fA-F0-9]{64}$/
const BODY_KEYS = ['paymentId', 'razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature'].sort()

export type RazorpayCheckoutCallback = {
  paymentId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseRazorpayCheckoutCallback(body: unknown): RazorpayCheckoutCallback | null {
  if (!isRecord(body)) return null

  const keys = Object.keys(body).sort()
  if (keys.length !== BODY_KEYS.length || keys.some((key, index) => key !== BODY_KEYS[index])) {
    return null
  }

  const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body
  if (typeof paymentId !== 'string' || !UUID.test(paymentId)
    || typeof razorpayOrderId !== 'string' || !PROVIDER_ORDER_ID.test(razorpayOrderId)
    || typeof razorpayPaymentId !== 'string' || !PROVIDER_PAYMENT_ID.test(razorpayPaymentId)
    || typeof razorpaySignature !== 'string' || !CHECKOUT_SIGNATURE.test(razorpaySignature)) {
    return null
  }

  return { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
}
