import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/lib/store-razorpay-operator-reconciliation.ts',import.meta.url),'utf8')

test('Store operator reconciliation remains server-only and inaccessible to HTTP',()=>{
  assert.match(source,/import 'server-only'/)
  assert.match(source,/authorizeOperator/)
  assert.match(source,/loadTrustedAttempt/)
  assert.match(source,/fetchVerifiedStoreProviderOrder/)
  assert.match(source,/deps\.correlate/)
  assert.match(source,/paymentReady: false/)
  assert.ok(source.indexOf('deps.authorizeOperator()') < source.indexOf('deps.loadTrustedAttempt(attemptId)'))
  assert.ok(source.indexOf('deps.loadTrustedAttempt(attemptId)') < source.indexOf('deps.correlate(attempt, evidence)'))
  assert.doesNotMatch(source,/export (async )?function (GET|POST)|createRazorpayOrder|STORE_RESERVATION_BRIDGE_ENABLED.*true/)
})
