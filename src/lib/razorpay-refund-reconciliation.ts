import 'server-only'

import { fetchRazorpayPayment, fetchRazorpayRefund, RazorpayRequestError } from '@/lib/razorpay'
import { safeWebhookErrorCode, validateCanonicalRazorpayRefund } from '@/lib/razorpay-webhook'

type ServiceRoleClient = ReturnType<typeof import('@/lib/supabase/service-role').createServiceRoleClient>

export type RefundReceiptInput = {
  providerEventId: string
  payload: unknown
  payloadSha256: string
  providerPaymentId: string
  providerRefundId: string
  refundAmount: number
  refundCurrency: string
}

type Receipt = {
  processing_status: string
  payment_id: string | null
  order_id: string | null
  amount: number | string | null
  refunded_amount?: number | string | null
  currency: string | null
  provider_payment_id: string
  provider_refund_id: string
}

export type RefundReconciliationResult = {
  outcome: 'processed' | 'failed' | 'unavailable' | 'receipt_error'
  retryable: boolean
}

/**
 * Claims and reconciles an authenticated Razorpay refund receipt. The caller is responsible for
 * establishing that `input.payload` came from a signature-verified receipt; this function never
 * accepts browser input and deliberately has no raw-webhook or signature-verification behavior.
 */
export async function reconcileRazorpayRefundReceipt(
  supabase: ServiceRoleClient,
  input: RefundReceiptInput,
): Promise<RefundReconciliationResult> {
  const { data, error: receiptError } = await supabase.rpc('begin_razorpay_refund_webhook_event', {
    p_provider_event_id: input.providerEventId,
    p_payload: input.payload,
    p_payload_sha256: input.payloadSha256,
    p_provider_payment_id: input.providerPaymentId,
    p_provider_refund_id: input.providerRefundId,
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

  let canonicalRefund
  let canonicalPayment
  try {
    // Both reads are deliberately fresh, server-side Razorpay GETs. Keep them sequential so a
    // missing refund does not cause an unnecessary parent-payment request.
    canonicalRefund = await fetchRazorpayRefund(input.providerRefundId)
    canonicalPayment = await fetchRazorpayPayment(input.providerPaymentId)
  } catch (error) {
    const retryable = error instanceof RazorpayRequestError && error.ambiguous
    await fail(retryable ? 'provider_temporarily_unavailable' : 'provider_refund_unavailable')
    return { outcome: retryable ? 'unavailable' : 'failed', retryable }
  }

  try {
    validateCanonicalRazorpayRefund(canonicalRefund, canonicalPayment, {
      refundId: input.providerRefundId,
      paymentId: input.providerPaymentId,
      webhookAmount: input.refundAmount,
      webhookCurrency: input.refundCurrency,
      paymentAmount: String(receipt.amount),
      paymentCurrency: receipt.currency,
      refundedAmount: String(receipt.refunded_amount ?? '0'),
    })
  } catch (error) {
    await fail(safeWebhookErrorCode(error))
    return { outcome: 'failed', retryable: false }
  }

  const { data: reconciled, error: reconcileError } = await supabase.rpc(
    'reconcile_processed_razorpay_refund',
    {
      p_provider_event_id: input.providerEventId,
      p_payload_sha256: input.payloadSha256,
      p_provider_refund_id: canonicalRefund.id,
      p_provider_payment_id: canonicalRefund.payment_id,
      p_refund_amount: canonicalRefund.amount,
      p_provider_currency: canonicalRefund.currency,
      p_provider_created_at: new Date(canonicalRefund.created_at * 1000).toISOString(),
    },
  )
  if (reconcileError) {
    const permanent = ['22023', 'P0001', '23505', '23514'].includes(reconcileError.code ?? '')
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
