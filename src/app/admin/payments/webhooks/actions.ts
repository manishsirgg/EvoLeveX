'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/admin-auth'
import { reconcileRazorpayRefundReceipt } from '@/lib/razorpay-refund-reconciliation'
import { extractRazorpayWebhook, validateRazorpayEventId } from '@/lib/razorpay-webhook'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256 = /^[a-f0-9]{64}$/
const PAYMENT_ID = /^pay_[A-Za-z0-9]{8,64}$/
const REFUND_ID = /^rfnd_[A-Za-z0-9]{8,64}$/

export type RetryRefundState = { status: 'idle' | 'success' | 'error'; message: string }
export const initialRetryRefundState: RetryRefundState = { status: 'idle', message: '' }

export async function retryRazorpayRefundWebhookEvent(
  eventId: string,
  _previousState: RetryRefundState,
): Promise<RetryRefundState> {
  void _previousState
  await requireAdmin()
  if (typeof eventId !== 'string' || !UUID.test(eventId)) {
    return { status: 'error', message: 'The webhook event identifier is invalid.' }
  }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('payment_webhook_events')
    .select('id,provider,provider_event_id,event_type,payload,payload_sha256,provider_payment_id,provider_refund_id,processing_status,processed_at')
    .eq('id', eventId)
    .maybeSingle()

  if (error || !row) return { status: 'error', message: 'The webhook event could not be loaded.' }
  if (row.provider !== 'razorpay' || row.event_type !== 'refund.processed'
    || row.processing_status !== 'failed' || row.processed_at !== null) {
    return { status: 'error', message: 'This webhook event is not eligible for refund reconciliation retry.' }
  }
  if (row.payload === null || !SHA256.test(row.payload_sha256 ?? '')
    || !validateRazorpayEventId(row.provider_event_id)
    || !PAYMENT_ID.test(row.provider_payment_id ?? '') || !REFUND_ID.test(row.provider_refund_id ?? '')) {
    return { status: 'error', message: 'The stored webhook evidence is incomplete or invalid.' }
  }

  let extracted
  try {
    extracted = extractRazorpayWebhook(row.payload)
  } catch {
    return { status: 'error', message: 'The stored webhook payload is malformed.' }
  }
  if (!extracted.supported || extracted.eventType !== 'refund.processed'
    || extracted.providerPaymentId !== row.provider_payment_id
    || extracted.providerRefundId !== row.provider_refund_id
    || extracted.refundAmount === null || extracted.refundCurrency === null) {
    return { status: 'error', message: 'The stored webhook evidence does not match its ledger identity.' }
  }

  const service = createServiceRoleClient()
  const result = await reconcileRazorpayRefundReceipt(service, {
    providerEventId: row.provider_event_id,
    payload: row.payload,
    payloadSha256: row.payload_sha256,
    providerPaymentId: extracted.providerPaymentId!,
    providerRefundId: extracted.providerRefundId!,
    refundAmount: extracted.refundAmount,
    refundCurrency: extracted.refundCurrency,
  })
  revalidatePath('/admin/payments/webhooks')
  if (result.outcome === 'processed') {
    return { status: 'success', message: 'Refund reconciliation completed successfully.' }
  }
  return result.retryable
    ? { status: 'error', message: 'Reconciliation is temporarily unavailable. The failure was recorded safely.' }
    : { status: 'error', message: 'Canonical verification or reconciliation failed. Review the safe error code.' }
}
