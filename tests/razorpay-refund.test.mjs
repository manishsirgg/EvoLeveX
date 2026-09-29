import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  extractRazorpayWebhook,
  validateCanonicalRazorpayRefund,
} from '../src/lib/razorpay-webhook.ts'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260929060000_razorpay_refund_reconciliation.sql', import.meta.url,
), 'utf8')
const route = readFileSync(new URL(
  '../src/app/api/payments/razorpay/webhook/route.ts', import.meta.url,
), 'utf8')
const orchestration = readFileSync(new URL(
  '../src/lib/razorpay-refund-reconciliation.ts', import.meta.url,
), 'utf8')
const disclosure = readFileSync(new URL(
  '../src/components/vault/vault-buy-now.tsx', import.meta.url,
), 'utf8')

const refundPayload = {
  event: 'refund.processed',
  payload: { refund: { entity: {
    id: 'rfnd_12345678', payment_id: 'pay_12345678', amount: 2500, currency: 'INR',
  } } },
}
const refund = {
  id: 'rfnd_12345678', payment_id: 'pay_12345678', amount: 2500, currency: 'INR',
  status: 'processed', created_at: 1790630000,
}
const payment = {
  id: 'pay_12345678', order_id: 'order_12345678', amount: 10000, currency: 'INR',
  status: 'captured', captured: true, amount_refunded: 2500, refund_status: 'partial',
}
const expected = {
  refundId: refund.id, paymentId: payment.id, webhookAmount: 2500, webhookCurrency: 'INR',
  paymentAmount: '100.00', paymentCurrency: 'INR', refundedAmount: '0',
}

test('refund.processed extraction is separate and malformed refund payloads are rejected', () => {
  assert.deepEqual(extractRazorpayWebhook(refundPayload), {
    eventType: 'refund.processed', providerPaymentId: 'pay_12345678', providerOrderId: null,
    providerRefundId: 'rfnd_12345678', refundAmount: 2500, refundCurrency: 'INR', supported: true,
  })
  assert.throws(() => extractRazorpayWebhook({ event: 'refund.processed', payload: {} }), /refund entity/)
  assert.throws(() => extractRazorpayWebhook({ ...refundPayload, payload: {
    refund: { entity: { ...refundPayload.payload.refund.entity, id: 'bad' } },
  } }), /Invalid refund entity/)
})

test('canonical processed refund validates identity, parent, amount, currency, and captured payment', () => {
  assert.doesNotThrow(() => validateCanonicalRazorpayRefund(refund, payment, expected))
  for (const [candidate, parent, patch, message] of [
    [{ ...refund, id: 'rfnd_87654321' }, payment, {}, 'provider_refund_id_mismatch'],
    [{ ...refund, payment_id: 'pay_87654321' }, payment, {}, 'parent_payment_mismatch'],
    [{ ...refund, amount: 2499 }, payment, {}, 'refund_amount_mismatch'],
    [{ ...refund, currency: 'USD' }, payment, {}, 'refund_currency_mismatch'],
    [refund, { ...payment, amount: 9999 }, {}, 'amount_mismatch'],
    [refund, { ...payment, captured: false }, {}, 'payment_not_captured'],
  ]) assert.throws(() => validateCanonicalRazorpayRefund(candidate, parent, { ...expected, ...patch }), new RegExp(message))
})

test('canonical refund rejects one refund greater than the captured payment', () => {
  assert.throws(() => validateCanonicalRazorpayRefund(
    { ...refund, amount: 10001 }, payment, { ...expected, webhookAmount: 10001 },
  ), /refund_exceeds_payment/)
  assert.throws(() => validateCanonicalRazorpayRefund(
    refund, { ...payment, amount_refunded: 10001 }, expected,
  ), /refund_exceeds_payment/)
})

test('processed full refund accepts Razorpay post-refund parent representation', () => {
  const liveAmount = 9607
  assert.doesNotThrow(() => validateCanonicalRazorpayRefund(
    { ...refund, amount: liveAmount, currency: 'INR' },
    { ...payment, amount: liveAmount, status: 'refunded', captured: true,
      amount_refunded: liveAmount, refund_status: 'full' },
    { ...expected, webhookAmount: liveAmount, paymentAmount: '96.07' },
  ))
})

test('post-refund parent state must remain captured and internally coherent', () => {
  const full = { ...payment, status: 'refunded', amount_refunded: payment.amount, refund_status: 'full' }
  for (const [parent, message] of [
    [{ ...full, captured: false }, 'payment_not_captured'],
    [{ ...full, refund_status: 'partial' }, 'invalid_parent_refund_state'],
    [{ ...full, amount_refunded: full.amount - 1 }, 'invalid_parent_refund_state'],
    [{ ...payment, amount_refunded: refund.amount - 1 }, 'refund_exceeds_payment'],
  ]) assert.throws(() => validateCanonicalRazorpayRefund(refund, parent, expected), new RegExp(message))
})

test('a duplicate canonical refund is valid after local refunded_amount already includes it', () => {
  assert.doesNotThrow(() => validateCanonicalRazorpayRefund(
    refund, payment, { ...expected, refundedAmount: '25.00' },
  ))
})

test('normalized refund ledger and cumulative amount have strict integrity and RLS', () => {
  assert.match(migration, /create table public\.payment_refunds/)
  assert.match(migration, /unique \(provider, provider_refund_id\)/)
  assert.match(migration, /check \(amount > 0\)/)
  assert.match(migration, /add column refunded_amount numeric not null default 0/)
  assert.match(migration, /refunded_amount <= amount/)
  assert.match(migration, /alter table public\.payment_refunds enable row level security/)
  assert.match(migration, /revoke all on table public\.payment_refunds from anon, authenticated/)
  assert.match(migration, /grant select on table public\.payment_refunds to authenticated/)
  assert.match(migration, /for select\s+to authenticated using \(\(select private\.is_staff\(\)\)\)/)
})

test('a signed refund for an unknown local payment returns an explicit bounded receipt', () => {
  const paymentLookup = migration.indexOf('where payment.provider = \'razorpay\' and payment.provider_payment_id = p_provider_payment_id;')
  const normalClaim = migration.indexOf("  if v_event.processing_status not in ('processed', 'ignored') then\n    update", paymentLookup)
  const missingPayment = migration.slice(paymentLookup, normalClaim)
  assert.match(missingPayment, /if not found then/)
  assert.match(missingPayment, /processing_status = 'processing'/)
  assert.match(missingPayment, /payment_id = null,[\s\S]*order_id = null/)
  assert.match(missingPayment, /return query select v_event\.processing_status, null::uuid, null::uuid,[\s\S]*null::numeric, null::numeric, null::text/)
  assert.match(orchestration, /if \(!receipt\.payment_id \|\| receipt\.amount === null \|\| !receipt\.currency\) {[\s\S]*fail\('local_payment_unavailable'\)/)
})

test('partial and cumulatively full refunds use normalized sums and preserve/revoke access correctly', () => {
  assert.match(migration, /sum\(refund\.amount\)[\s\S]*refund\.status = 'processed'/)
  assert.match(migration, /if v_cumulative > v_payment\.amount then/)
  assert.match(migration, /if v_cumulative < v_payment\.amount then[\s\S]*status = 'partially_refunded'/)
  const partial = migration.slice(migration.indexOf('if v_cumulative <'), migration.indexOf('  else', migration.indexOf('if v_cumulative <')))
  assert.doesNotMatch(partial, /digital_access/)
  assert.match(migration, /set refunded_amount = v_cumulative, status = 'refunded'/)
  assert.match(migration, /set payment_status = 'refunded', status = 'refunded'/)
  assert.match(migration, /access\.order_item_id = item\.id[\s\S]*access\.status = 'active'/)
})

test('same refund under different event IDs is never double counted and duplicate events converge', () => {
  assert.match(migration, /on conflict \(provider, provider_refund_id\) do nothing/)
  assert.match(migration, /v_existing\.payment_id is distinct from v_payment\.id/)
  assert.match(migration, /if v_event\.processing_status = 'processed'/)
  assert.match(migration, /payload_sha256 is distinct from p_payload_sha256/)
})

test('the same failed provider event is reclaimable without mutating its receipt', () => {
  const begin = migration.slice(
    migration.indexOf('create function public.begin_razorpay_refund_webhook_event'),
    migration.indexOf('create function public.reconcile_processed_razorpay_refund'),
  )
  assert.match(begin, /if v_event\.processing_status not in \('processed', 'ignored'\) then/)
  assert.match(begin, /processing_status = 'processing'/)
  assert.match(begin, /attempt_count = attempt_count \+ 1/)
  assert.match(begin, /processing_error = null, safe_error_code = null/)
})

test('the payment row serializes different concurrent partial refunds before ledger insertion and summing', () => {
  const reconcile = migration.slice(migration.indexOf('create function public.reconcile_processed_razorpay_refund'))
  const paymentLock = reconcile.indexOf('provider_payment_id = p_provider_payment_id for update')
  const ledgerInsert = reconcile.indexOf('insert into public.payment_refunds')
  const cumulativeSum = reconcile.indexOf('select pg_catalog.coalesce(pg_catalog.sum(refund.amount), 0)')
  assert.ok(paymentLock >= 0 && paymentLock < ledgerInsert && ledgerInsert < cumulativeSum)
})

test('captured-payment reconciliation cannot restore a fully refunded payment or order', () => {
  const stage3c = readFileSync(new URL(
    '../supabase/migrations/20260929050000_razorpay_webhook_reconciliation.sql', import.meta.url,
  ), 'utf8')
  assert.match(stage3c, /v_payment\.status = 'paid'[\s\S]*v_order\.payment_status = 'paid'[\s\S]*v_order\.status = 'confirmed'/)
  assert.match(stage3c, /elsif v_payment\.provider_payment_id is not null or v_payment\.status <> 'pending'[\s\S]*v_order\.payment_status <> 'pending' or v_order\.status <> 'pending' then[\s\S]*Payment requires reconciliation/)
})

test('repurchase refreshes provenance while delayed old refund uses compare-and-set provenance', () => {
  assert.match(migration, /order_item_id = excluded\.order_item_id/)
  assert.match(migration, /granted_at = excluded\.granted_at/)
  assert.match(migration, /order_item_id is distinct from excluded\.order_item_id/)
  assert.match(migration, /access\.order_item_id = item\.id/)
})

test('refund RPC is service-only, security-definer, fully qualified, and atomically completes event', () => {
  assert.match(migration, /create function public\.reconcile_processed_razorpay_refund[\s\S]*security definer set search_path = ''/)
  assert.match(migration, /revoke all on function public\.reconcile_processed_razorpay_refund[\s\S]*public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.reconcile_processed_razorpay_refund[\s\S]*to service_role/)
  assert.match(migration, /update public\.payment_webhook_events set processing_status = 'processed'/)
})

test('route canonically fetches both refund and payment and retains exact raw signature gate', () => {
  assert.match(route, /verifyRazorpayWebhookSignature\(rawBody, signature, secret\)/)
  assert.match(route, /reconcileRazorpayRefundReceipt\(supabase/)
  assert.match(orchestration, /fetchRazorpayRefund\(input\.providerRefundId\)/)
  assert.match(orchestration, /fetchRazorpayPayment\(input\.providerPaymentId\)/)
  assert.match(orchestration, /validateCanonicalRazorpayRefund/)
  assert.match(orchestration, /reconcile_processed_razorpay_refund/)
})

test('Vault checkout has applicable-law-aware digital finality disclosure and no refund action', () => {
  assert.match(disclosure, /downloadable files cannot be returned once delivered/)
  assert.match(disclosure, /except where required by applicable law/)
  assert.doesNotMatch(disclosure, /Issue Refund|Request Refund|no refunds under any circumstances/i)
})
