import { NextResponse } from 'next/server'

import { reconcileRazorpayCapturedPaymentReceipt } from '@/lib/razorpay-captured-payment-reconciliation'
import { reconcileRazorpayRefundReceipt } from '@/lib/razorpay-refund-reconciliation'
import {
  extractRazorpayWebhook,
  validateRazorpayEventId,
  verifyRazorpayWebhookSignature,
  webhookPayloadSha256,
} from '@/lib/razorpay-webhook'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'

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

  const result = await reconcileRazorpayCapturedPaymentReceipt(supabase, {
    providerEventId: providerEventId!,
    eventType: extracted.eventType as 'payment.captured' | 'order.paid',
    payload,
    payloadSha256,
    providerOrderId: extracted.providerOrderId!,
    providerPaymentId: extracted.providerPaymentId!,
  })
  if (result.outcome === 'processed') return json({ accepted: true, status: 'processed' })
  if (result.outcome === 'failed') return json({ accepted: true, status: 'failed' })
  if (result.outcome === 'receipt_error') return json({ error: 'Webhook processing failed' }, 500)
  return json({ error: 'Webhook processing unavailable' }, 503)
}
