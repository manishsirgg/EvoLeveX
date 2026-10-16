import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { TrustedStoreProviderAttempt } from '@/lib/store-razorpay-operator-reconciliation'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ORDER_ID = /^order_[A-Za-z0-9]{8,64}$/
const RECEIPT = /^evs_[0-9a-f]{32}$/
const MONEY = /^(?:0|[1-9]\d{0,11})\.\d{2}$/

/**
 * Authorized, audited read-only adapter for existing correlated provider orders.
 * Do not wire to customer endpoints. Uncorrelated attempts have no known provider
 * ID and cannot safely be resolved through a caller-selected ID.
 */
export async function loadAuthorizedStoreProviderAttempt(attemptId: string):
  Promise<TrustedStoreProviderAttempt> {
  if (!UUID.test(attemptId)) throw new Error('STORE_PROVIDER_ATTEMPT_INVALID')

  const supabase = await createClient()
  const { data: userResult, error: userError } = await supabase.auth.getUser()
  if (userError || !userResult.user) throw new Error('STORE_PROVIDER_OPERATOR_UNAUTHORIZED')

  const { data: eligible, error: eligibilityError } =
    await supabase.rpc('can_operate_evo_store_reconciliation')
  if (eligibilityError || eligible !== true) {
    throw new Error('STORE_PROVIDER_OPERATOR_UNAUTHORIZED')
  }

  // The RPC rechecks administrator role and audits the read atomically.
  // The normal authenticated Supabase client preserves the caller's JWT.
  const { data, error } = await supabase.rpc(
    'read_evo_store_provider_attempt_for_reconciliation',
    { p_attempt_id: attemptId },
  )
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('STORE_PROVIDER_TRUSTED_READ_FAILED')
  }
  const value = data as Record<string, unknown>
  const amount = typeof value.amount === 'number'
    && Number.isFinite(value.amount) && value.amount > 0
    ? value.amount.toFixed(2) : value.amount

  if (value.attempt_id !== attemptId
    || typeof value.intent_id !== 'string' || !UUID.test(value.intent_id)
    || typeof value.order_id !== 'string' || !UUID.test(value.order_id)
    || typeof value.provider_order_id !== 'string' || !ORDER_ID.test(value.provider_order_id)
    || typeof value.receipt !== 'string' || !RECEIPT.test(value.receipt)
    || typeof amount !== 'string' || !MONEY.test(amount)
    || typeof value.currency !== 'string'
    || !['USD','EUR','GBP','INR','CAD','AUD','NZD','SGD','AED','JPY'].includes(value.currency)
    || value.state !== 'correlated'
    || value.payment_ready !== false) {
    // A missing provider-order ID (including dispatch_uncertain) is intentionally
    // not resolved from untrusted caller input or by guessing a provider order.
    throw new Error('STORE_PROVIDER_TRUSTED_ATTEMPT_INVALID')
  }

  return {
    attemptId,
    intentId: value.intent_id,
    orderId: value.order_id,
    providerOrderId: value.provider_order_id,
    receipt: value.receipt,
    amount,
    currency: value.currency,
    state: 'correlated',
  }
}
