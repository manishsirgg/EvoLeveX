'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

import {
  openRazorpayCheckout,
  TrustedRazorpayOrder,
} from '@/components/payments/razorpay-checkout'
import type { SupportedCurrency } from '@/lib/currency'
import { createClient } from '@/lib/supabase/client'

type BrowserClient = ReturnType<typeof createClient>

type ProviderOrderResponse = {
  body: unknown
  isJson: boolean
  status: number
}

type CheckoutIdentifiers = {
  razorpayOrderId: string
  razorpayPaymentId: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDER_ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const PROVIDER_PAYMENT_ID = /^pay_[A-Za-z0-9]{8,64}$/
const CHECKOUT_SIGNATURE = /^[a-fA-F0-9]{64}$/

function trustedProviderOrder(value: unknown): TrustedRazorpayOrder | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const order = value as Record<string, unknown>
  if (typeof order.orderId !== 'string' || !UUID.test(order.orderId)
    || typeof order.paymentId !== 'string' || !UUID.test(order.paymentId)
    || typeof order.providerOrderId !== 'string' || !PROVIDER_ORDER_ID.test(order.providerOrderId)
    || typeof order.amount !== 'number' || !Number.isSafeInteger(order.amount) || order.amount <= 0
    || typeof order.currency !== 'string' || !/^[A-Z]{3}$/.test(order.currency)
    || typeof order.keyId !== 'string' || !order.keyId.trim()) return null

  return {
    keyId: order.keyId,
    providerOrderId: order.providerOrderId,
    amount: order.amount,
    currency: order.currency,
    paymentId: order.paymentId,
  }
}

type TestVaultOrderClientProps = {
  selectedCurrency: SupportedCurrency
}

export function TestVaultOrderClient({ selectedCurrency }: TestVaultOrderClientProps) {
  const supabaseRef = useRef<BrowserClient | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [productId, setProductId] = useState('')
  const [authError, setAuthError] = useState<unknown>(null)
  const [rpcData, setRpcData] = useState<unknown>(null)
  const [rpcError, setRpcError] = useState<unknown>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [razorpayOrderId, setRazorpayOrderId] = useState('')
  const [razorpayRpcData, setRazorpayRpcData] = useState<unknown>(null)
  const [razorpayRpcError, setRazorpayRpcError] = useState<unknown>(null)
  const [isReservingRazorpayPayment, setIsReservingRazorpayPayment] = useState(false)
  const [providerOrderId, setProviderOrderId] = useState('')
  const [providerOrderResponse, setProviderOrderResponse] =
    useState<ProviderOrderResponse | null>(null)
  const [providerOrderError, setProviderOrderError] = useState<string | null>(null)
  const [isCreatingProviderOrder, setIsCreatingProviderOrder] = useState(false)
  const [checkoutOrderId, setCheckoutOrderId] = useState('')
  const [checkoutOrderResponse, setCheckoutOrderResponse] =
    useState<ProviderOrderResponse | null>(null)
  const [checkoutIdentifiers, setCheckoutIdentifiers] = useState<CheckoutIdentifiers | null>(null)
  const [verificationResponse, setVerificationResponse] =
    useState<ProviderOrderResponse | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isCheckoutRunning, setIsCheckoutRunning] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabaseRef.current = supabase
    let isCurrent = true

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!isCurrent) return

      setUserId(data.user?.id ?? null)
      setAuthError(error)
    })

    return () => {
      isCurrent = false
      supabaseRef.current = null
    }
  }, [])

  async function createPendingOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId || !productId.trim() || isSubmitting) return

    setIsSubmitting(true)
    setRpcData(null)
    setRpcError(null)

    try {
      const response = await fetch('/api/vault/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: productId.trim() }),
      })
      const data = await response.json() as Record<string, unknown>
      setRpcData(data)
      if (!response.ok) {
        setRpcError({ status: response.status, body: data })
      } else if (typeof data.orderId === 'string' && UUID.test(data.orderId)) {
        setRazorpayOrderId(data.orderId)
        setProviderOrderId(data.orderId)
        setCheckoutOrderId(data.orderId)
      }
    } catch (error) {
      setRpcError(error instanceof Error ? error.message : 'Request failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function reserveRazorpayPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const supabase = supabaseRef.current
    if (!supabase || !userId || !razorpayOrderId.trim() || isReservingRazorpayPayment) return

    setIsReservingRazorpayPayment(true)
    setRazorpayRpcData(null)
    setRazorpayRpcError(null)

    const { data, error } = await supabase.rpc('reserve_razorpay_payment', {
      p_order_id: razorpayOrderId.trim(),
    })

    setRazorpayRpcData(data)
    setRazorpayRpcError(error)
    setIsReservingRazorpayPayment(false)
  }

  async function createProviderOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!providerOrderId.trim() || isCreatingProviderOrder) return

    setIsCreatingProviderOrder(true)
    setProviderOrderResponse(null)
    setProviderOrderError(null)

    try {
      const response = await fetch('/api/payments/razorpay/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: providerOrderId.trim() }),
      })
      const responseText = await response.text()

      try {
        setProviderOrderResponse({
          body: JSON.parse(responseText),
          isJson: true,
          status: response.status,
        })
      } catch {
        setProviderOrderResponse({
          body: 'Response body was not valid JSON.',
          isJson: false,
          status: response.status,
        })
      }
    } catch (error) {
      setProviderOrderError(error instanceof Error ? error.message : 'Request failed.')
    } finally {
      setIsCreatingProviderOrder(false)
    }
  }

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!checkoutOrderId.trim() || isCheckoutRunning) return

    setIsCheckoutRunning(true)
    setCheckoutOrderResponse(null)
    setCheckoutIdentifiers(null)
    setVerificationResponse(null)
    setCheckoutError(null)

    try {
      const orderResponse = await fetch('/api/payments/razorpay/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: checkoutOrderId.trim() }),
      })
      const orderText = await orderResponse.text()
      let orderBody: unknown
      try {
        orderBody = JSON.parse(orderText)
      } catch {
        setCheckoutOrderResponse({
          body: 'Response body was not valid JSON.',
          isJson: false,
          status: orderResponse.status,
        })
        throw new Error('Provider-order response was not valid JSON.')
      }

      const order = trustedProviderOrder(orderBody)
      const displayBody = order && typeof orderBody === 'object'
        ? { ...(orderBody as Record<string, unknown>), keyId: '[public key ID supplied to Checkout]' }
        : orderBody
      setCheckoutOrderResponse({ body: displayBody, isJson: true, status: orderResponse.status })
      if (!orderResponse.ok) throw new Error('Provider-order request was not successful.')
      if (!order || (orderBody as Record<string, unknown>).orderId !== checkoutOrderId.trim()) {
        throw new Error('Provider-order response failed validation.')
      }

      const checkoutResult = await openRazorpayCheckout(order)
      if (checkoutResult.outcome === 'dismissed') {
        setCheckoutError('Checkout was dismissed. No local payment state was changed by the client.')
        return
      }
      if (checkoutResult.outcome === 'failed') {
        const { code, description, reason, source, step } = checkoutResult.error
        setCheckoutError(`Checkout reported a payment failure: ${JSON.stringify({
          code, description, reason, source, step,
        })}`)
        return
      }

      const callback = checkoutResult.response
      if (callback.razorpay_order_id !== order.providerOrderId
        || !PROVIDER_PAYMENT_ID.test(callback.razorpay_payment_id)
        || !CHECKOUT_SIGNATURE.test(callback.razorpay_signature)) {
        throw new Error('Checkout callback failed validation.')
      }
      setCheckoutIdentifiers({
        razorpayOrderId: callback.razorpay_order_id,
        razorpayPaymentId: callback.razorpay_payment_id,
      })

      const verifyResponse = await fetch('/api/payments/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: order.paymentId,
          razorpayPaymentId: callback.razorpay_payment_id,
          razorpayOrderId: callback.razorpay_order_id,
          razorpaySignature: callback.razorpay_signature,
        }),
      })
      const verifyText = await verifyResponse.text()
      try {
        setVerificationResponse({
          body: JSON.parse(verifyText),
          isJson: true,
          status: verifyResponse.status,
        })
      } catch {
        setVerificationResponse({
          body: 'Response body was not valid JSON.',
          isJson: false,
          status: verifyResponse.status,
        })
      }
      if (!verifyResponse.ok) setCheckoutError('Payment verification was not successful. It was not retried.')
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout request failed.')
    } finally {
      setIsCheckoutRunning(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 text-zinc-100">
      <h1 className="text-2xl font-semibold">Test Vault order</h1>

      <dl className="mt-6 grid gap-2 text-sm">
        <div>
          <dt className="font-medium text-zinc-400">Authenticated user UUID</dt>
          <dd className="mt-1 break-all">{userId ?? 'No authenticated user found.'}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-400">Selected global currency</dt>
          <dd className="mt-1">{selectedCurrency}</dd>
        </div>
      </dl>

      {authError ? (
        <pre className="mt-4 overflow-auto whitespace-pre-wrap text-sm text-rose-300">
          {JSON.stringify(authError, null, 2)}
        </pre>
      ) : null}

      <form className="mt-8 grid gap-4" onSubmit={createPendingOrder}>
        <label className="grid gap-2 text-sm font-medium" htmlFor="vault-product-id">
          Vault product UUID
          <input
            id="vault-product-id"
            className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
        </label>
        <button
          type="submit"
          className="w-fit border border-amber-300 px-4 py-2 font-medium text-amber-300 disabled:opacity-50"
          disabled={!userId || !productId.trim() || isSubmitting}
        >
          {isSubmitting ? 'Creating…' : 'Create pending order'}
        </button>
      </form>

      <section className="mt-8 grid gap-4" aria-live="polite">
        <div>
          <h2 className="font-medium">Trusted order snapshot</h2>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm">
            {rpcData === null
              ? 'No order yet. The response displays orderId, currency, totalAmount, and created.'
              : JSON.stringify(rpcData, null, 2)}
          </pre>
        </div>
        <div>
          <h2 className="font-medium">Order endpoint error</h2>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm text-rose-300">
            {rpcError === null ? 'No RPC error.' : JSON.stringify(rpcError, null, 2)}
          </pre>
        </div>
      </section>

      <section className="mt-12 border-t border-zinc-700 pt-8">
        <h2 className="text-xl font-semibold">Test Razorpay Reservation</h2>
        <p className="mt-2 text-sm text-amber-300">Temporary dev-only RPC test.</p>

        <form className="mt-6 grid gap-4" onSubmit={reserveRazorpayPayment}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="razorpay-order-id">
            Local order UUID
            <input
              id="razorpay-order-id"
              className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={razorpayOrderId}
              onChange={(event) => setRazorpayOrderId(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </label>
          <button
            type="submit"
            className="w-fit border border-amber-300 px-4 py-2 font-medium text-amber-300 disabled:opacity-50"
            disabled={!userId || !razorpayOrderId.trim() || isReservingRazorpayPayment}
          >
            {isReservingRazorpayPayment ? 'Reserving…' : 'Reserve Razorpay payment'}
          </button>
        </form>

        <div className="mt-8 grid gap-4" aria-live="polite">
          <div>
            <h3 className="font-medium">Razorpay reservation RPC data</h3>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm">
              {razorpayRpcData === null
                ? 'No Razorpay reservation RPC data yet.'
                : JSON.stringify(razorpayRpcData, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="font-medium">Razorpay reservation RPC error</h3>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm text-rose-300">
              {razorpayRpcError === null
                ? 'No Razorpay reservation RPC error.'
                : JSON.stringify(razorpayRpcError, null, 2)}
            </pre>
          </div>
        </div>
      </section>

      <section className="mt-12 border-t border-zinc-700 pt-8">
        <h2 className="text-xl font-semibold">Test Razorpay Provider Order</h2>
        <p className="mt-2 text-sm text-amber-300">Temporary dev-only server route test.</p>

        <form className="mt-6 grid gap-4" onSubmit={createProviderOrder}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="provider-order-id">
            Local order UUID
            <input
              id="provider-order-id"
              className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={providerOrderId}
              onChange={(event) => setProviderOrderId(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </label>
          <button
            type="submit"
            className="w-fit border border-amber-300 px-4 py-2 font-medium text-amber-300 disabled:opacity-50"
            disabled={!providerOrderId.trim() || isCreatingProviderOrder}
          >
            Create/reuse Razorpay provider order
          </button>
        </form>

        <div className="mt-8 grid gap-4" aria-live="polite">
          <div>
            <h3 className="font-medium">HTTP status</h3>
            <p className="mt-2 text-sm">
              {providerOrderResponse?.status ?? 'No response yet.'}
            </p>
          </div>
          <div>
            <h3 className="font-medium">Response body</h3>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm">
              {providerOrderResponse === null
                ? 'No response body yet.'
                : providerOrderResponse.isJson
                  ? JSON.stringify(providerOrderResponse.body, null, 2)
                  : String(providerOrderResponse.body)}
            </pre>
          </div>
          <div>
            <h3 className="font-medium">Request/network error</h3>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm text-rose-300">
              {providerOrderError ?? 'No request/network error.'}
            </pre>
          </div>
        </div>
      </section>

      <section className="mt-12 border-t border-zinc-700 pt-8">
        <h2 className="text-xl font-semibold">Test Razorpay Checkout</h2>
        <p className="mt-2 text-sm font-medium text-rose-300">
          Temporary dev-only LIVE payment test.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={startCheckout}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="checkout-order-id">
            Local order UUID
            <input
              id="checkout-order-id"
              className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              value={checkoutOrderId}
              onChange={(event) => setCheckoutOrderId(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="w-fit border border-rose-300 px-4 py-2 font-medium text-rose-300 disabled:opacity-50"
            disabled={!userId || !checkoutOrderId.trim() || isCheckoutRunning}
          >
            {isCheckoutRunning ? 'Checkout in progress…' : 'Open LIVE Razorpay Checkout'}
          </button>
        </form>

        <div className="mt-8 grid gap-4" aria-live="polite">
          <div>
            <h3 className="font-medium">Provider-order HTTP status</h3>
            <p className="mt-2 text-sm">{checkoutOrderResponse?.status ?? 'No response yet.'}</p>
          </div>
          <div>
            <h3 className="font-medium">Provider-order response</h3>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm">
              {checkoutOrderResponse === null
                ? 'No response body yet.'
                : checkoutOrderResponse.isJson
                  ? JSON.stringify(checkoutOrderResponse.body, null, 2)
                  : String(checkoutOrderResponse.body)}
            </pre>
          </div>
          <div>
            <h3 className="font-medium">Checkout callback identifiers (signature omitted)</h3>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm">
              {checkoutIdentifiers === null
                ? 'No successful Checkout callback yet.'
                : JSON.stringify(checkoutIdentifiers, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="font-medium">Verification HTTP status</h3>
            <p className="mt-2 text-sm">{verificationResponse?.status ?? 'No response yet.'}</p>
          </div>
          <div>
            <h3 className="font-medium">Verification response</h3>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm">
              {verificationResponse === null
                ? 'No verification response yet.'
                : verificationResponse.isJson
                  ? JSON.stringify(verificationResponse.body, null, 2)
                  : String(verificationResponse.body)}
            </pre>
          </div>
          <div>
            <h3 className="font-medium">Checkout/client error</h3>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-sm text-rose-300">
              {checkoutError ?? 'No Checkout/client error.'}
            </pre>
          </div>
        </div>
      </section>
    </main>
  )
}
