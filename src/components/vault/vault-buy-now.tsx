'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'

import { openRazorpayCheckout } from '@/components/payments/razorpay-checkout'
import type { SupportedCurrency } from '@/lib/currency'
import {
  formatTrustedMoney,
  isTrustedCheckoutCallback,
  parseProviderOrderResponse,
  parseVaultOrderResponse,
  pricesMatch,
  type TrustedVaultOrder,
} from '@/lib/vault-checkout'

type CheckoutStage = 'idle' | 'order' | 'provider' | 'checkout' | 'verify' | 'success'

type VaultBuyNowProps = {
  productId: string
  productName: string
  returnPath: string
  isAuthenticated: boolean
  isOwned: boolean
  displayAmount: string | number
  displayCurrency: SupportedCurrency
}

const labels: Record<CheckoutStage, string> = {
  idle: 'Buy Now', order: 'Preparing secure checkout…', provider: 'Preparing secure checkout…',
  checkout: 'Opening secure payment…', verify: 'Verifying payment…', success: 'Payment successful',
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function VaultBuyNow({ productId, productName, returnPath, isAuthenticated, isOwned,
  displayAmount, displayCurrency }: VaultBuyNowProps) {
  const running = useRef(false)
  const [stage, setStage] = useState<CheckoutStage>('idle')
  const [message, setMessage] = useState('Secure checkout powered by Razorpay.')
  const [messageKind, setMessageKind] = useState<'neutral' | 'error' | 'notice'>('neutral')
  const [refreshedOrder, setRefreshedOrder] = useState<TrustedVaultOrder | null>(null)
  const [paidAmount, setPaidAmount] = useState<string | null>(null)

  if (isOwned) {
    return (
      <div className="vault-owned-state" role="status">
        <strong>Already owned</strong>
        <span>This title is already associated with your EvoLeveX account.</span>
        <Link href="/account/library">View library</Link>
      </div>
    )
  }

  if (stage === 'success') {
    return (
      <div className="vault-checkout-success" role="status" aria-live="polite">
        <span className="vault-success-mark" aria-hidden="true">✓</span>
        <div>
          <strong>Payment successful</strong>
          <p>Your order for {productName} is confirmed{paidAmount ? ` at ${paidAmount}` : ''}.</p>
          <p className="vault-fulfillment-note">Your digital access will appear after fulfillment is completed.</p>
        </div>
        <div className="vault-success-links">
          <Link href="/vault">Back to Evo Vault</Link>
          <Link href="/account/library">View library</Link>
        </div>
      </div>
    )
  }

  const busy = stage !== 'idle'
  const shownAmount = refreshedOrder
    ? formatTrustedMoney(refreshedOrder.totalAmount, refreshedOrder.currency)
    : null

  async function handleBuy() {
    if (running.current) return
    if (!isAuthenticated) {
      window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`)
      return
    }

    running.current = true
    setMessageKind('neutral')
    setMessage('Preparing your secure checkout.')

    try {
      let order = refreshedOrder
      if (!order) {
        setStage('order')
        const response = await fetch('/api/vault/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        })
        const body = await readJson(response)
        if (response.status === 401) {
          window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`)
          return
        }
        order = response.ok ? parseVaultOrderResponse(body) : null
        if (!order) throw new Error('We could not prepare your order. Please try again.')

        if (!pricesMatch(
          { amount: displayAmount, currency: displayCurrency },
          { amount: order.totalAmount, currency: order.currency },
        )) {
          setRefreshedOrder(order)
          setMessageKind('notice')
          setMessage(`The price refreshed to ${formatTrustedMoney(order.totalAmount, order.currency)}. Review it, then select Buy Now again.`)
          return
        }
      }

      setStage('provider')
      const providerResponse = await fetch('/api/payments/razorpay/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.orderId }),
      })
      const providerBody = await readJson(providerResponse)
      const providerOrder = providerResponse.ok ? parseProviderOrderResponse(providerBody) : null
      if (!providerOrder || providerOrder.orderId !== order.orderId
        || providerOrder.currency !== order.currency) {
        throw new Error('We could not open secure payment. Please try again.')
      }

      setStage('checkout')
      const checkout = await openRazorpayCheckout(providerOrder)
      if (checkout.outcome === 'dismissed') {
        setMessage('Checkout was closed. Your payment was not marked complete.')
        return
      }
      if (checkout.outcome === 'failed') {
        setMessageKind('error')
        setMessage('The payment was not completed. You can try again when ready.')
        return
      }
      if (!isTrustedCheckoutCallback(checkout.response)
        || checkout.response.razorpay_order_id !== providerOrder.providerOrderId) {
        throw new Error('We could not validate the payment response. Please contact support if you were charged.')
      }

      setStage('verify')
      const verificationResponse = await fetch('/api/payments/razorpay/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: providerOrder.paymentId,
          razorpayOrderId: checkout.response.razorpay_order_id,
          razorpayPaymentId: checkout.response.razorpay_payment_id,
          razorpaySignature: checkout.response.razorpay_signature,
        }),
      })
      const verification = await readJson(verificationResponse) as Record<string, unknown> | null
      if (!verificationResponse.ok || verification?.paymentStatus !== 'paid'
        || verification.orderStatus !== 'confirmed') {
        throw new Error('Payment verification is still incomplete. Please contact support if you were charged.')
      }

      setPaidAmount(formatTrustedMoney(order.totalAmount, order.currency))
      setStage('success')
    } catch (error) {
      setMessageKind('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally {
      running.current = false
      setStage((current) => current === 'success' ? current : 'idle')
    }
  }

  return (
    <>
      {shownAmount && <p className="vault-refreshed-price" aria-live="polite">Current checkout price <strong>{shownAmount}</strong></p>}
      <button className="button button-primary vault-buy-button" type="button" disabled={busy}
        aria-describedby="vault-purchase-message" onClick={handleBuy}>
        {labels[stage]}
      </button>
      <p id="vault-purchase-message" role={messageKind === 'error' ? 'alert' : 'status'} aria-live="polite"
        className={`vault-purchase-status vault-purchase-status--${messageKind}`}>{message}</p>
      <p className="vault-purchase-note">Digital product. Access is provided after successful payment. Because downloadable files cannot be returned once delivered, digital purchases are generally final and non-refundable after access is provided, except where required by applicable law.</p>
    </>
  )
}
