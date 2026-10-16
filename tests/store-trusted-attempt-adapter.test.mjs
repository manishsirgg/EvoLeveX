import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/lib/store-razorpay-trusted-attempt-adapter.ts',import.meta.url),'utf8')

test('trusted Store attempt reader preserves authenticated operator and auditable RPC',()=>{
  assert.match(source,/import 'server-only'/)
  assert.match(source,/supabase\.auth\.getUser\(\)/)
  assert.match(source,/can_operate_evo_store_reconciliation/)
  assert.match(source,/read_evo_store_provider_attempt_for_reconciliation/)
  assert.ok(source.indexOf('supabase.auth.getUser()') < source.indexOf('can_operate_evo_store_reconciliation'))
  assert.ok(source.indexOf('can_operate_evo_store_reconciliation') < source.indexOf('read_evo_store_provider_attempt_for_reconciliation'))
  assert.match(source,/value\.state !== 'correlated'/)
  assert.match(source,/value\.payment_ready !== false/)
})
test('trusted Store reader cannot initiate or mutate provider payment',()=>{
  assert.doesNotMatch(source,/createServiceRoleClient|createRazorpayOrder|fetch\(|GRANT EXECUTE|fetchVerifiedStoreProviderOrder|\.from\(/)
  assert.doesNotMatch(source,/export (async )?function (GET|POST)/)
})
