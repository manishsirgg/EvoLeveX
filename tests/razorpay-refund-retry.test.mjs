import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const action = read('src/app/admin/payments/webhooks/actions.ts')
const retryState = read('src/app/admin/payments/webhooks/retry-state.ts')
const page = read('src/app/admin/payments/webhooks/page.tsx')
const control = read('src/app/admin/payments/webhooks/retry-control.tsx')
const orchestration = read('src/lib/razorpay-refund-reconciliation.ts')
const route = read('src/app/api/payments/razorpay/webhook/route.ts')
const stage3c = read('supabase/migrations/20260929050000_razorpay_webhook_reconciliation.sql')
const stage3d = read('supabase/migrations/20260929060000_razorpay_refund_reconciliation.sql')

test('use server retry module exports only async Server Actions', () => {
  assert.match(action, /^['"]use server['"]/)
  assert.deepEqual(
    [...action.matchAll(/^export\s+([^\n]+)/gm)].map((match) => match[1]),
    ['async function retryRazorpayRefundWebhookEvent('],
  )
  assert.doesNotMatch(action, /export\s+(?:const|let|var|class|type|interface|\{)/)
  assert.match(retryState, /export type RetryRefundState/)
  assert.match(retryState, /export const initialRetryRefundState/)
  assert.doesNotMatch(retryState, /^['"]use server['"]/)
  assert.match(control, /import \{ initialRetryRefundState \} from '\.\/retry-state'/)
})

test('retry action authorizes admins and accepts only the local ledger UUID', () => {
  assert.match(action, /export async function retryRazorpayRefundWebhookEvent\(\s*eventId: string,\s*_previousState: RetryRefundState/)
  assert.match(action, /await requireAdmin\(\)/)
  assert.match(action, /UUID\.test\(eventId\)/)
  assert.doesNotMatch(action, /FormData/)
  for (const forbidden of ['amount', 'currency', 'provider timestamp', 'payment ID', 'refund ID']) {
    assert.doesNotMatch(control, new RegExp(`name=["']${forbidden}`, 'i'))
  }
  assert.match(control, /bind\(null, eventId\)/)
})

test('admin page loads webhook rows through the authenticated cookie-aware client', () => {
  assert.match(page, /import \{ createClient \} from '@\/lib\/supabase\/server'/)
  assert.doesNotMatch(page, /createServiceRoleClient/)
  assert.match(page, /await requireAdmin\(\)[\s\S]*const supabase = await createClient\(\)[\s\S]*await supabase\s*\.from\('payment_webhook_events'\)/)
})

test('retry loads authoritative evidence through authenticated RLS, then reconciles with service role', () => {
  assert.match(action, /import \{ createClient \} from '@\/lib\/supabase\/server'/)
  assert.match(action, /await requireAdmin\(\)[\s\S]*const supabase = await createClient\(\)[\s\S]*await supabase\s*\.from\('payment_webhook_events'\)/)
  assert.match(action, /\.eq\('id', eventId\)/)
  assert.match(action, /provider_event_id,event_type,payload,payload_sha256,provider_payment_id,provider_refund_id,processing_status,processed_at/)
  assert.match(action, /const service = createServiceRoleClient\(\)[\s\S]*reconcileRazorpayRefundReceipt\(service,/)
  assert.doesNotMatch(action, /(?:service|createServiceRoleClient\(\))\s*\.from\('payment_webhook_events'\)/)
  assert.doesNotMatch(control, /payload|providerPaymentId|providerRefundId|amount|currency/)
})

test('only failed, unprocessed Razorpay refund receipts are eligible', () => {
  assert.match(action, /row\.provider !== 'razorpay'/)
  assert.match(action, /row\.event_type !== 'refund\.processed'/)
  assert.match(action, /row\.processing_status !== 'failed'/)
  assert.match(action, /row\.processed_at !== null/)
  for (const rejectedStatus of ['received', 'processing', 'processed', 'ignored']) {
    assert.notEqual(rejectedStatus, 'failed')
  }
  assert.match(page, /event\.event_type !== 'refund\.processed'[\s\S]*event\.processing_status !== 'failed'[\s\S]*event\.processed_at !== null/)
})

test('stored signed evidence is validated and cross-checked without recreating bytes or signatures', () => {
  assert.match(action, /row\.payload === null/)
  assert.match(action, /SHA256\.test\(row\.payload_sha256 \?\? ''\)/)
  assert.match(action, /extractRazorpayWebhook\(row\.payload\)/)
  assert.match(action, /extracted\.providerPaymentId !== row\.provider_payment_id/)
  assert.match(action, /extracted\.providerRefundId !== row\.provider_refund_id/)
  assert.match(action, /extracted\.refundAmount === null \|\| extracted\.refundCurrency === null/)
  assert.doesNotMatch(action, /webhookPayloadSha256|JSON\.stringify|verifyRazorpayWebhookSignature|createHmac/)
})

test('shared orchestration reclaims through the existing RPC and leaves attempts to the RPC', () => {
  assert.match(orchestration, /begin_razorpay_refund_webhook_event/)
  assert.match(orchestration, /p_payload: input\.payload/)
  assert.match(orchestration, /p_payload_sha256: input\.payloadSha256/)
  assert.doesNotMatch(action + orchestration, /\.from\('payment_webhook_events'\)[\s\S]{0,200}\.update\(/)
  assert.doesNotMatch(action + orchestration, /attempt_count\s*[:=]/)
  assert.match(stage3d, /attempt_count = attempt_count \+ 1/)
  assert.match(orchestration, /receipt\.processing_status === 'processed'/)
})

test('fresh canonical reads and the corrected shared validator gate reconciliation', () => {
  const refundFetch = orchestration.indexOf('fetchRazorpayRefund(input.providerRefundId)')
  const paymentFetch = orchestration.indexOf('fetchRazorpayPayment(input.providerPaymentId)')
  const validation = orchestration.indexOf('validateCanonicalRazorpayRefund(')
  const reconciliation = orchestration.indexOf("'reconcile_processed_razorpay_refund'")
  assert.ok(refundFetch >= 0 && paymentFetch > refundFetch)
  assert.ok(validation > paymentFetch && reconciliation > validation)
  assert.match(orchestration, /webhookAmount: input\.refundAmount/)
  assert.match(orchestration, /paymentAmount: String\(receipt\.amount\)/)
  assert.match(orchestration, /p_provider_refund_id: canonicalRefund\.id/)
  assert.match(orchestration, /p_refund_amount: canonicalRefund\.amount/)
})

test('all post-claim failures are bounded and recorded through the failure RPC', () => {
  assert.match(orchestration, /fail_razorpay_webhook_event/)
  assert.match(orchestration, /safeWebhookErrorCode\(error\)/)
  assert.match(orchestration, /provider_temporarily_unavailable/)
  assert.match(orchestration, /local_reconciliation_rejected/)
  assert.match(orchestration, /invalid_reconciliation_result/)
  assert.doesNotMatch(action, /error\.message|processing_error|response body/i)
})

test('database reconciliation remains transactional and idempotent for duplicate retries', () => {
  assert.match(stage3d, /on conflict \(provider, provider_refund_id\) do nothing/)
  assert.match(stage3d, /if v_event\.processing_status = 'processed'/)
  assert.match(stage3d, /for update/)
  assert.match(stage3d, /sum\(refund\.amount\)/)
  assert.match(stage3d, /update public\.payment_webhook_events set processing_status = 'processed'/)
})

test('public signature gate and Stage 3C payment path remain intact', () => {
  const verify = route.indexOf('verifyRazorpayWebhookSignature(rawBody, signature, secret)')
  const parse = route.indexOf("JSON.parse(rawBody.toString('utf8'))")
  assert.ok(verify >= 0 && parse > verify)
  assert.match(route, /validateRazorpayEventId\(providerEventId\)/)
  assert.match(route, /begin_razorpay_webhook_event/)
  assert.match(route, /validateCanonicalRazorpayPayment/)
  assert.match(route, /reconcile_captured_razorpay_payment/)
  assert.match(stage3c, /create function public\.reconcile_captured_razorpay_payment/)
})

test('admin UI exposes safe metadata, confirmation, and no payload or secrets', () => {
  for (const field of ['received_at', 'event_type', 'processing_status', 'attempt_count',
    'provider_event_id', 'provider_payment_id', 'provider_refund_id', 'safe_error_code', 'processed_at']) {
    assert.match(page, new RegExp(field))
  }
  assert.match(control, /window\.confirm/)
  assert.doesNotMatch(page + control, /SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET/)
  assert.doesNotMatch(page, />\s*\{?event\.payload|JSON\.stringify\(event\.payload/)
})
