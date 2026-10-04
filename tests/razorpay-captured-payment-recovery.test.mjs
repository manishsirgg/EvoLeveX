import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const action = read('src/app/admin/payments/webhooks/actions.ts')
const helper = read('src/lib/razorpay-captured-payment-reconciliation.ts')
const route = read('src/app/api/payments/razorpay/webhook/route.ts')
const control = read('src/app/admin/payments/webhooks/retry-control.tsx')
const intakeRpc = read('supabase/migrations/20260929050000_razorpay_webhook_reconciliation.sql')
const captureRpc = read('supabase/migrations/20260929080000_evo_vault_checkout_expiry.sql')
const refundRpc = read('supabase/migrations/20260929060000_razorpay_refund_reconciliation.sql')

test('captured recovery authorizes before accepting only a local ledger UUID', () => {
  const body = action.slice(action.indexOf('export async function retryRazorpayCapturedPaymentWebhookEvent'))
  assert.ok(body.indexOf('await requireAdmin()') < body.indexOf('UUID.test(eventId)'))
  assert.ok(body.indexOf('await requireAdmin()') < body.indexOf('createServiceRoleClient()'))
  assert.match(body, /\.eq\('id', eventId\)/)
  assert.doesNotMatch(body, /FormData|verifyRazorpayWebhookSignature|webhookPayloadSha256|createHmac/)
  assert.doesNotMatch(control, /<input|<select|<textarea/)
})

test('eligibility and stored receipt evidence are closed over the approved states and identities', () => {
  assert.match(action, /row\.provider !== 'razorpay'/)
  assert.match(action, /row\.event_type !== 'payment\.captured' && row\.event_type !== 'order\.paid'/)
  assert.match(action, /row\.processing_status !== 'failed' \|\| row\.processed_at !== null/)
  assert.match(action, /row\.payload === null/)
  assert.match(action, /SHA256\.test\(row\.payload_sha256 \?\? ''\)/)
  assert.match(action, /validateRazorpayEventId\(row\.provider_event_id\)/)
  assert.match(action, /ORDER_ID\.test\(row\.provider_order_id \?\? ''\)/)
  assert.match(action, /PAYMENT_ID\.test\(row\.provider_payment_id \?\? ''\)/)
  assert.match(action, /extractRazorpayWebhook\(row\.payload\)/)
  assert.match(action, /extracted\.eventType !== row\.event_type/)
  assert.match(action, /extracted\.providerPaymentId !== row\.provider_payment_id/)
  assert.match(action, /extracted\.providerOrderId !== row\.provider_order_id/)
})

test('claim precedes canonical fetch, validation, and atomic reconciliation', () => {
  const claim = helper.indexOf("'begin_razorpay_webhook_event'")
  const processed = helper.indexOf("receipt.processing_status === 'processed'")
  const local = helper.indexOf('!receipt.payment_id')
  const fetch = helper.indexOf('fetchRazorpayPayment(input.providerPaymentId)')
  const validate = helper.indexOf('validateCanonicalRazorpayPayment(canonical')
  const reconcile = helper.indexOf("'reconcile_captured_razorpay_payment'")
  assert.ok(claim >= 0 && processed > claim && local > processed && fetch > local
    && validate > fetch && reconcile > validate)
  assert.match(helper, /amount: String\(receipt\.amount\)/)
  assert.match(helper, /currency: receipt\.currency/)
  assert.match(helper, /p_provider_order_id: canonical\.order_id/)
  assert.match(helper, /p_provider_payment_id: canonical\.id/)
})

test('every post-claim failure class is recorded through the bounded failure RPC', () => {
  assert.match(helper, /fail_razorpay_webhook_event/)
  for (const code of ['local_payment_unavailable', 'provider_temporarily_unavailable',
    'provider_payment_unavailable', 'local_reconciliation_rejected',
    'local_reconciliation_unavailable', 'invalid_reconciliation_result']) {
    assert.match(helper, new RegExp(code))
  }
  assert.match(helper, /safeWebhookErrorCode\(error\)/)
  assert.doesNotMatch(action + helper, /error\.message|response body|processing_error/i)
})

test('canonical mismatch matrix remains enforced by the shared payment validator', () => {
  const validator = read('src/lib/razorpay-webhook.ts')
  for (const code of ['provider_payment_id_mismatch', 'provider_order_id_mismatch',
    'payment_not_captured', 'captured_flag_false', 'currency_mismatch', 'amount_mismatch']) {
    assert.match(validator, new RegExp(code))
  }
})

test('webhook and recovery share orchestration without weakening raw HMAC intake', () => {
  const signature = route.indexOf('verifyRazorpayWebhookSignature(rawBody, signature, secret)')
  const parse = route.indexOf("JSON.parse(rawBody.toString('utf8'))")
  const shared = route.indexOf('reconcileRazorpayCapturedPaymentReceipt(supabase')
  assert.ok(signature >= 0 && parse > signature && shared > parse)
  assert.equal((route.match(/reconcileRazorpayCapturedPaymentReceipt\(supabase/g) ?? []).length, 1)
})

test('existing database path preserves retries, convergence, expiry, and refund protections', () => {
  assert.match(intakeRpc, /attempt_count = attempt_count \+ 1/)
  assert.match(captureRpc, /if v_event\.processing_status = 'processed'/)
  assert.match(captureRpc, /Browser-first or duplicate webhook convergence/)
  assert.match(captureRpc, /checkout_expired_at is not null/)
  assert.match(captureRpc, /perform public\.fulfill_confirmed_evo_vault_order/)
  assert.match(captureRpc, /v_payment\.status = 'paid'/)
  assert.doesNotMatch(captureRpc, /v_payment\.status in \('paid',\s*'partially_refunded',\s*'refunded'\)/)
  assert.match(refundRpc, /status = 'partially_refunded'/)
  assert.match(refundRpc, /status = 'refunded'/)
  assert.match(refundRpc, /revoked_at = v_now/)
})

test('capture RPCs remain service-only and browser roles cannot execute them', () => {
  for (const name of ['begin_razorpay_webhook_event', 'fail_razorpay_webhook_event',
    'reconcile_captured_razorpay_payment']) {
    assert.match(captureRpc, new RegExp(`revoke all on function public\\.${name}[^;]+from public, anon, authenticated`))
    assert.match(captureRpc, new RegExp(`grant execute on function public\\.${name}[^;]+to service_role`))
  }
})
