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
  status: 'captured', captured: true,
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
    { ...refund, amount: 2500 }, payment, { ...expected, refundedAmount: '80.00' },
  ), /refund_exceeds_payment/)
})

test('normalized refund ledger and cumulative amount have strict integrity and RLS', () => {
  assert.match(migration, /create table public\.payment_refunds/)
  assert.match(migration, /unique \(provider, provider_refund_id\)/)
  assert.match(migration, /check \(amount > 0\)/)
  assert.match(migration, /add column refunded_amount numeric not null default 0/)
  assert.match(migration, /refunded_amount <= amount/)
  assert.match(migration, /alter table public\.payment_refunds enable row level security/)
  assert.match(migration, /revoke all on table public\.payment_refunds from anon, authenticated/)
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
  assert.match(route, /fetchRazorpayRefund\(extracted\.providerRefundId!\)/)
  assert.match(route, /fetchRazorpayPayment\(extracted\.providerPaymentId!\)/)
  assert.match(route, /validateCanonicalRazorpayRefund/)
  assert.match(route, /reconcile_processed_razorpay_refund/)
})

test('Vault checkout has applicable-law-aware digital finality disclosure and no refund action', () => {
  assert.match(disclosure, /downloadable files cannot be returned once delivered/)
  assert.match(disclosure, /except where required by applicable law/)
  assert.doesNotMatch(disclosure, /Issue Refund|Request Refund|no refunds under any circumstances/i)
})
