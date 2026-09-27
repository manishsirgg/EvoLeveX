'use client'

const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

export type RazorpayCheckoutSuccess = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayFailure = {
  error?: {
    code?: string
    description?: string
    reason?: string
    source?: string
    step?: string
  }
}

type RazorpayOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  handler: (response: RazorpayCheckoutSuccess) => void
  modal: { ondismiss: () => void }
  theme: { color: string }
}

type RazorpayInstance = {
  on(event: 'payment.failed', handler: (response: RazorpayFailure) => void): void
  open(): void
}

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

export type TrustedRazorpayOrder = {
  keyId: string
  providerOrderId: string
  amount: number
  currency: string
  paymentId: string
}

export type RazorpayCheckoutResult =
  | { outcome: 'success'; response: RazorpayCheckoutSuccess }
  | { outcome: 'dismissed' }
  | { outcome: 'failed'; error: NonNullable<RazorpayFailure['error']> }

let scriptPromise: Promise<void> | null = null

function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT_URL}"]`,
    )
    const script = existing ?? document.createElement('script')

    const loaded = () => {
      if (window.Razorpay) resolve()
      else reject(new Error('Razorpay Checkout did not initialize.'))
    }
    const failed = () => reject(new Error('Unable to load Razorpay Checkout.'))

    script.addEventListener('load', loaded, { once: true })
    script.addEventListener('error', failed, { once: true })
    if (!existing) {
      script.src = CHECKOUT_SCRIPT_URL
      script.async = true
      document.body.appendChild(script)
    }
  }).catch((error: unknown) => {
    scriptPromise = null
    throw error
  })

  return scriptPromise
}

export async function openRazorpayCheckout(
  order: TrustedRazorpayOrder,
): Promise<RazorpayCheckoutResult> {
  await loadCheckoutScript()
  if (!window.Razorpay) throw new Error('Razorpay Checkout is unavailable.')

  return new Promise((resolve) => {
    let completed = false
    const complete = (result: RazorpayCheckoutResult) => {
      if (completed) return
      completed = true
      resolve(result)
    }

    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.providerOrderId,
      amount: order.amount,
      currency: order.currency,
      name: 'EvoLeveX',
      description: 'Evo Vault digital book',
      handler: (response) => complete({ outcome: 'success', response }),
      modal: { ondismiss: () => complete({ outcome: 'dismissed' }) },
      theme: { color: '#fbbf24' },
    })

    checkout.on('payment.failed', ({ error }) => {
      complete({ outcome: 'failed', error: error ?? {} })
    })
    checkout.open()
  })
}
