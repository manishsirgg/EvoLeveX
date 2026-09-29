import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const data = read('src/lib/customer-orders.ts')
const list = read('src/app/account/orders/page.tsx')
const detail = read('src/app/account/orders/[id]/page.tsx')
const nav = read('src/app/account/account-nav.tsx')

test('account navigation includes Orders and supports nested detail routes', () => {
  assert.match(nav, /\/account\/library', label: 'My Library'[\s\S]*\/account\/orders', label: 'Orders'/)
  assert.match(nav, /pathname\.startsWith\(`\$\{link\.href\}\//)
})

test('customer reads use the cookie client and authenticated RLS without caller user ids', () => {
  assert.match(list, /createClient\(\)[\s\S]*auth\.getUser\(\)[\s\S]*getCustomerOrders\(supabase\)/)
  assert.match(detail, /createClient\(\)[\s\S]*auth\.getUser\(\)[\s\S]*getCustomerOrder\(supabase, id\)/)
  assert.doesNotMatch(data, /service.?role|createServiceRoleClient|\.eq\('user_id'/i)
  assert.doesNotMatch(data, /insert\(|update\(|delete\(|upsert\(/)
})

test('order list uses a safe projection and deterministic newest-first ordering', () => {
  assert.match(data, /ORDER_LIST_COLUMNS = 'id,status,payment_status,total_amount,currency,created_at,checkout_expires_at,checkout_expired_at'/)
  assert.match(data, /order\('created_at', \{ ascending: false \}\)\.order\('id', \{ ascending: false \}\)/)
  assert.match(list, /No orders yet/)
})

test('elapsed unpaid checkouts render Expired without exposing provider details', () => {
  assert.match(data, /function isExpiredCheckout[\s\S]*checkout_expires_at[\s\S]*deadline <= now/)
  assert.match(list + detail, /isExpiredCheckout\(order\)[\s\S]*StatusBadge value="expired"/)
})

test('detail candidate is UUID validated and ownership remains an indistinguishable RLS lookup', () => {
  assert.match(data, /if \(!isUuid\(orderId\)\) return \{ data: null, error: null \}/)
  assert.match(data, /from\('orders'\)[\s\S]*\.eq\('id', orderId\)\.maybeSingle\(\)/)
  assert.match(detail, /if \(!result\.error && !result\.data\) notFound\(\)/)
})

test('historical item snapshots and aggregate payment refunds are rendered', () => {
  assert.match(data, /product_name_snapshot/)
  assert.match(detail, /item\.product_name_snapshot/)
  assert.match(data, /refunded_amount,paid_at,refunded_at/)
  assert.match(detail, /Partially refunded/)
  assert.match(detail, /Refunded in full/)
})

test('active non-revoked digital access enables only a library link', () => {
  assert.match(data, /from\('digital_access'\)[\s\S]*eq\('status', 'active'\)[\s\S]*is\('revoked_at', null\)/)
  assert.match(detail, /activeVaultProductIds\.has[\s\S]*View in My Library/)
  assert.doesNotMatch(detail, /signedUrl|createSignedUrl|file_path|evo-private/)
})

test('customer order feature excludes sensitive ledgers and provider internals', () => {
  const feature = `${data}\n${list}\n${detail}`
  assert.doesNotMatch(feature, /payment_refunds|payment_webhook_events/)
  assert.doesNotMatch(feature, /provider_(payment|order|refund|event)_id|safe_error_code|processing_error|payload|signature/)
})
