import { NextResponse } from 'next/server'

import { fetchRazorpayPayment, RazorpayRequestError } from '@/lib/razorpay'
import { reconcileRazorpayRefundReceipt } from '@/lib/razorpay-refund-reconciliation'
import {
  extractRazorpayWebhook,
  safeWebhookErrorCode,
  validateCanonicalRazorpayPayment,
  validateRazorpayEventId,
  verifyRazorpayWebhookSignature,
  webhookPayloadSha256,
} from '@/lib/razorpay-webhook'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'

type Receipt = {
  processing_status: string
  payment_id: string | null
  order_id: string | null
  amount: number | string | null
  refunded_amount?: number | string | null
  currency: string | null
  provider_order_id: string
  provider_payment_id: string
}

function json(body: object, status = 200) {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return json({ error: 'Webhook is unavailable' }, 503)

  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await request.arrayBuffer())
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }
  const signature = request.headers.get('x-razorpay-signature')
  if (!verifyRazorpayWebhookSignature(rawBody, signature, secret)) {
    return json({ error: 'Invalid webhook signature' }, 401)
  }

  const providerEventId = request.headers.get('x-razorpay-event-id')
  if (!validateRazorpayEventId(providerEventId)) {
    return json({ error: 'Invalid webhook event identity' }, 400)
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return json({ error: 'Invalid webhook payload' }, 400)
  }

  let extracted
  try {
    extracted = extractRazorpayWebhook(payload)
  } catch {
    return json({ error: 'Invalid webhook payload' }, 400)
  }
  const payloadSha256 = webhookPayloadSha256(rawBody)

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return json({ error: 'Webhook processing unavailable' }, 503)
  }

  if (!extracted.supported) {
    const { error } = await supabase.rpc('ignore_razorpay_webhook_event', {
      p_provider_event_id: providerEventId!, p_event_type: extracted.eventType,
      p_payload: payload, p_payload_sha256: payloadSha256,
    })
    if (error) return json({ error: 'Webhook processing failed' }, 500)
    return json({ accepted: true, status: 'ignored' })
  }

  if (extracted.eventType === 'refund.processed') {
    const result = await reconcileRazorpayRefundReceipt(supabase, {
      providerEventId: providerEventId!, payload, payloadSha256,
      providerPaymentId: extracted.providerPaymentId!,
      providerRefundId: extracted.providerRefundId!, refundAmount: extracted.refundAmount!,
      refundCurrency: extracted.refundCurrency!,
    })
    if (result.outcome === 'processed') return json({ accepted: true, status: 'processed' })
    if (result.outcome === 'failed') return json({ accepted: true, status: 'failed' })
    if (result.outcome === 'receipt_error') return json({ error: 'Webhook processing failed' }, 500)
    return json({ error: 'Webhook processing unavailable' }, 503)
  }

  const { data, error: receiptError } = await supabase.rpc('begin_razorpay_webhook_event', {
    p_provider_event_id: providerEventId!, p_event_type: extracted.eventType,
    p_payload: payload, p_payload_sha256: payloadSha256,
    p_provider_order_id: extracted.providerOrderId!,
    p_provider_payment_id: extracted.providerPaymentId!,
  })
  if (receiptError) return json({ error: 'Webhook processing failed' }, 500)
  const receipt = (Array.isArray(data) ? data[0] : data) as Receipt | null
  if (!receipt) return json({ error: 'Webhook processing failed' }, 500)
  if (receipt.processing_status === 'processed') {
    return json({ accepted: true, status: 'processed' })
  }

  const fail = async (code: string) => {
    await supabase.rpc('fail_razorpay_webhook_event', {
      p_provider_event_id: providerEventId!, p_payload_sha256: payloadSha256,
      p_safe_error_code: code,
    })
  }
  if (!receipt.payment_id || receipt.amount === null || !receipt.currency) {
    await fail('local_payment_unavailable')
    return json({ error: 'Webhook processing unavailable' }, 503)
  }

  let canonical
  try {
    canonical = await fetchRazorpayPayment(extracted.providerPaymentId!)
  } catch (error) {
    const retryable = error instanceof RazorpayRequestError && error.ambiguous
    await fail(retryable ? 'provider_temporarily_unavailable' : 'provider_payment_unavailable')
    return retryable
      ? json({ error: 'Webhook processing unavailable' }, 503)
      : json({ accepted: true, status: 'failed' })
  }

  try {
    validateCanonicalRazorpayPayment(canonical, {
      paymentId: extracted.providerPaymentId!, orderId: extracted.providerOrderId!,
      amount: String(receipt.amount), currency: receipt.currency,
    })
  } catch (error) {
    await fail(safeWebhookErrorCode(error))
    return json({ accepted: true, status: 'failed' })
  }

  const { data: reconciled, error: reconcileError } = await supabase.rpc(
    'reconcile_captured_razorpay_payment',
    {
      p_provider_event_id: providerEventId!, p_payload_sha256: payloadSha256,
      p_provider_order_id: canonical.order_id, p_provider_payment_id: canonical.id,
      p_provider_amount: canonical.amount, p_provider_currency: canonical.currency,
    },
  )
  if (reconcileError) {
    const permanent = ['22023', 'P0001', '23505'].includes(reconcileError.code ?? '')
    await fail(permanent ? 'local_reconciliation_rejected' : 'local_reconciliation_unavailable')
    return permanent
      ? json({ accepted: true, status: 'failed' })
      : json({ error: 'Webhook processing unavailable' }, 503)
  }
  const result = Array.isArray(reconciled) ? reconciled[0] : reconciled
  if (!result || result.processing_status !== 'processed') {
    await fail('invalid_reconciliation_result')
    return json({ error: 'Webhook processing unavailable' }, 503)
  }
  return json({ accepted: true, status: 'processed' })
}
