import 'server-only'

import { fetchRazorpayPayment, RazorpayRequestError } from '@/lib/razorpay'
import { safeWebhookErrorCode, validateCanonicalRazorpayPayment } from '@/lib/razorpay-webhook'

type ServiceRoleClient = ReturnType<typeof import('@/lib/supabase/service-role').createServiceRoleClient>

export type CapturedPaymentReceiptInput = {
  providerEventId: string
  eventType: 'payment.captured' | 'order.paid'
  payload: unknown
  payloadSha256: string
  providerOrderId: string
  providerPaymentId: string
}

type Receipt = {
  processing_status: string
  payment_id: string | null
  amount: number | string | null
  currency: string | null
}

export type CapturedPaymentReconciliationResult = {
  outcome: 'processed' | 'failed' | 'unavailable' | 'receipt_error'
  retryable: boolean
}

/**
 * Claims and reconciles an authenticated captured-payment receipt. The caller must establish that
 * the evidence came from a signature-verified stored receipt. No browser-supplied payment facts
 * are accepted by this helper.
 */
export async function reconcileRazorpayCapturedPaymentReceipt(
  supabase: ServiceRoleClient,
  input: CapturedPaymentReceiptInput,
): Promise<CapturedPaymentReconciliationResult> {
  const { data, error: receiptError } = await supabase.rpc('begin_razorpay_webhook_event', {
    p_provider_event_id: input.providerEventId,
    p_event_type: input.eventType,
    p_payload: input.payload,
    p_payload_sha256: input.payloadSha256,
    p_provider_order_id: input.providerOrderId,
    p_provider_payment_id: input.providerPaymentId,
  })
  if (receiptError) return { outcome: 'receipt_error', retryable: true }

  const receipt = (Array.isArray(data) ? data[0] : data) as Receipt | null
  if (!receipt) return { outcome: 'receipt_error', retryable: true }
  if (receipt.processing_status === 'processed') return { outcome: 'processed', retryable: false }

  const fail = async (code: string) => {
    await supabase.rpc('fail_razorpay_webhook_event', {
      p_provider_event_id: input.providerEventId,
      p_payload_sha256: input.payloadSha256,
      p_safe_error_code: code,
    })
  }

  if (!receipt.payment_id || receipt.amount === null || !receipt.currency) {
    await fail('local_payment_unavailable')
    return { outcome: 'unavailable', retryable: true }
  }

  let canonical
  try {
    canonical = await fetchRazorpayPayment(input.providerPaymentId)
  } catch (error) {
    const retryable = error instanceof RazorpayRequestError && error.ambiguous
    await fail(retryable ? 'provider_temporarily_unavailable' : 'provider_payment_unavailable')
    return { outcome: retryable ? 'unavailable' : 'failed', retryable }
  }

  try {
    validateCanonicalRazorpayPayment(canonical, {
      paymentId: input.providerPaymentId,
      orderId: input.providerOrderId,
      amount: String(receipt.amount),
      currency: receipt.currency,
    })
  } catch (error) {
    await fail(safeWebhookErrorCode(error))
    return { outcome: 'failed', retryable: false }
  }

  const { data: reconciled, error: reconcileError } = await supabase.rpc(
    'reconcile_captured_razorpay_payment',
    {
      p_provider_event_id: input.providerEventId,
      p_payload_sha256: input.payloadSha256,
      p_provider_order_id: canonical.order_id,
      p_provider_payment_id: canonical.id,
      p_provider_amount: canonical.amount,
      p_provider_currency: canonical.currency,
    },
  )
  if (reconcileError) {
    const permanent = ['22023', 'P0001', '23505'].includes(reconcileError.code ?? '')
    await fail(permanent ? 'local_reconciliation_rejected' : 'local_reconciliation_unavailable')
    return { outcome: permanent ? 'failed' : 'unavailable', retryable: !permanent }
  }

  const result = Array.isArray(reconciled) ? reconciled[0] : reconciled
  if (!result || result.processing_status !== 'processed') {
    await fail('invalid_reconciliation_result')
    return { outcome: 'unavailable', retryable: true }
  }
  return { outcome: 'processed', retryable: false }
}
