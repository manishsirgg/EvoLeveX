import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const code=await readFile(new URL('../src/lib/store-razorpay-verified-operator-read.ts',import.meta.url),'utf8')
test('provider order evidence originates from authenticated audited read',()=>{
 assert.match(code,/import 'server-only'/)
 assert.match(code,/loadAuthorizedStoreProviderAttempt/)
 assert.match(code,/fetchVerifiedStoreProviderOrder/)
 assert.ok(code.indexOf('loadAttempt ?? loadAuthorizedStoreProviderAttempt')<code.indexOf('fetchEvidence ?? fetchVerifiedStoreProviderOrder'))
 assert.match(code,/attempt\.state !== 'correlated'/)
 assert.match(code,/paymentReady: false/)
})
test('operator verification read has no payment or correlation mutation',()=>{
 assert.doesNotMatch(code,/\.rpc\(|\.from\(|\.insert\(|\.update\(|createServiceRoleClient|fetch\(|capturePayment|prepare_evo_store_provider_attempt/)
 assert.doesNotMatch(code,/export (async )?function (GET|POST)/)
})
