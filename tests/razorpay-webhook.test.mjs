import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  extractRazorpayWebhook,
  safeWebhookErrorCode,
  validateCanonicalRazorpayPayment,
  validateRazorpayEventId,
  verifyRazorpayWebhookSignature,
  webhookPayloadSha256,
} from '../src/lib/razorpay-webhook.ts'
import { toRazorpaySubunits } from '../src/lib/razorpay-money.ts'

const secret = 'test-webhook-secret-not-a-production-secret'
const captured = {
  event: 'payment.captured',
  payload: { payment: { entity: { id: 'pay_12345678', order_id: 'order_12345678' } } },
}
const migration = readFileSync(new URL(
  '../supabase/migrations/20260929050000_razorpay_webhook_reconciliation.sql', import.meta.url,
), 'utf8')

test('validates a signature over the exact raw bytes', () => {
  const raw = Buffer.from(JSON.stringify(captured))
  const signature = createHmac('sha256', secret).update(raw).digest('hex')
  assert.equal(verifyRazorpayWebhookSignature(raw, signature, secret), true)
  assert.equal(verifyRazorpayWebhookSignature(Buffer.from(`${raw.toString()}\n`), signature, secret), false)
})

test('rejects invalid, missing, and malformed signatures', () => {
  const raw = Buffer.from('{}')
  assert.equal(verifyRazorpayWebhookSignature(raw, '0'.repeat(64), secret), false)
  assert.equal(verifyRazorpayWebhookSignature(raw, null, secret), false)
  assert.equal(verifyRazorpayWebhookSignature(raw, 'not-hex', secret), false)
})

test('extracts payment.captured and order.paid payment entities defensively', () => {
  assert.deepEqual(extractRazorpayWebhook(captured), {
    eventType: 'payment.captured', providerPaymentId: 'pay_12345678',
    providerOrderId: 'order_12345678', supported: true,
  })
  const orderPaid = structuredClone(captured)
  orderPaid.event = 'order.paid'
  assert.equal(extractRazorpayWebhook(orderPaid).providerPaymentId, 'pay_12345678')
  assert.throws(() => extractRazorpayWebhook({ event: 'order.paid', payload: {} }), /payment entity/)
})

test('ignores unsupported, authorized, and failed events without extracting payment IDs', () => {
  for (const event of ['payment.authorized', 'payment.failed', 'refund.created']) {
    assert.deepEqual(extractRazorpayWebhook({ event, payload: captured.payload }), {
      eventType: event, providerPaymentId: null, providerOrderId: null, supported: false,
    })
  }
})

test('validates stable event IDs and hashes authenticated raw payloads', () => {
  assert.equal(validateRazorpayEventId('evt_123:delivery-1'), true)
  assert.equal(validateRazorpayEventId(null), false)
  assert.equal(validateRazorpayEventId('bad event'), false)
  assert.match(webhookPayloadSha256(Buffer.from('{}')), /^[a-f0-9]{64}$/)
})

test('canonical payment must match IDs, captured state, currency, and exact amount', () => {
  const canonical = {
    id: 'pay_12345678', order_id: 'order_12345678', amount: 9593,
    currency: 'INR', status: 'captured', captured: true,
  }
  const expected = {
    paymentId: canonical.id, orderId: canonical.order_id, amount: '95.93', currency: 'INR',
  }
  assert.doesNotThrow(() => validateCanonicalRazorpayPayment(canonical, expected))
  for (const [field, value, message] of [
    ['id', 'pay_87654321', 'provider_payment_id_mismatch'],
    ['order_id', 'order_87654321', 'provider_order_id_mismatch'],
    ['status', 'authorized', 'payment_not_captured'],
    ['captured', false, 'captured_flag_false'],
    ['currency', 'USD', 'currency_mismatch'],
    ['amount', 9592, 'amount_mismatch'],
  ]) {
    assert.throws(
      () => validateCanonicalRazorpayPayment({ ...canonical, [field]: value }, expected),
      new RegExp(message),
    )
  }
})

test('money conversion covers required INR, USD, and zero-decimal JPY behavior', () => {
  assert.equal(toRazorpaySubunits('95.93', 'INR'), 9593)
  assert.equal(toRazorpaySubunits('12.99', 'USD'), 1299)
  assert.equal(toRazorpaySubunits('1299', 'JPY'), 1299)
})

test('diagnostics expose only stable codes and never arbitrary error details', () => {
  assert.equal(safeWebhookErrorCode(new Error('currency_mismatch')), 'currency_mismatch')
  assert.equal(safeWebhookErrorCode(new Error('secret=customer data')), 'webhook_processing_failed')
  assert.equal(safeWebhookErrorCode({ token: 'sensitive' }), 'webhook_processing_failed')
})

test('ledger duplicate handling is hash-bound, retryable, and service-role only', () => {
  assert.match(migration, /on conflict \(provider, provider_event_id\) do nothing/g)
  assert.match(migration, /payload_sha256 is distinct from p_payload_sha256/)
  assert.match(migration, /attempt_count = attempt_count \+ 1/)
  assert.match(migration, /processing_status = 'failed', processed_at = null/)
  assert.match(migration, /grant execute on function public\.reconcile_captured_razorpay_payment[\s\S]*to service_role/)
  assert.match(migration, /revoke all on function public\.reconcile_captured_razorpay_payment[\s\S]*authenticated/)
})

test('browser-first, webhook-first, and conflicting payment IDs converge under locks', () => {
  assert.match(migration, /from public\.payments payment[\s\S]*for update/)
  assert.match(migration, /from public\.orders candidate[\s\S]*for update/)
  assert.match(migration, /provider_payment_id is not distinct from p_provider_payment_id/)
  assert.match(migration, /elsif v_payment\.provider_payment_id is not null/)
  assert.match(migration, /perform public\.fulfill_confirmed_evo_vault_order\(v_order\.id\)/)
  assert.ok(migration.indexOf('perform public.fulfill_confirmed_evo_vault_order')
    < migration.lastIndexOf("processing_status = 'processed'"))
})
